"""Forecast endpoints.

POST /forecast/run         -- kick off a forecast (returns job_id)
GET  /forecast/status/...  -- poll job status
GET  /forecast/results/... -- retrieve computed results
"""

from __future__ import annotations

import asyncio
import io

import pandas as pd
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.models.forecast import ForecastRequest
from api.models.responses import (
    CAGRIndustryRow,
    CAGRRow,
    JobStatusResponse,
    PagedResponse,
    StackedChartData,
    SummaryMetrics,
)
from api.services.forecast_service import (
    build_config,
    build_gdp_trends_data,
    build_stacked_chart_data,
    compute_cagr_by_industry,
    compute_summary_metrics,
    run_forecast,
)

router = APIRouter(prefix="/forecast", tags=["forecast"])

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
# Each entry is:
#   { "status": str, "progress": int|None, "error": str|None,
#     "created_at": str, "completed_at": str|None, "results": dict|None }
_jobs: dict[str, dict[str, Any]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Background runner
# ---------------------------------------------------------------------------

def _run_forecast_blocking(job_id: str, config: dict) -> None:
    """Executed in a worker thread via ``asyncio.to_thread``."""
    _jobs[job_id]["status"] = "running"
    _jobs[job_id]["progress"] = 0
    try:
        results = run_forecast(config)
        _jobs[job_id]["results"] = results
        _jobs[job_id]["status"] = "completed"
        _jobs[job_id]["progress"] = 100
        _jobs[job_id]["completed_at"] = _now_iso()
    except Exception as exc:  # noqa: BLE001
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        _jobs[job_id]["completed_at"] = _now_iso()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/run", response_model=JobStatusResponse)
async def run_forecast_endpoint(request: ForecastRequest | None = None):
    """Start a forecast run in the background.

    Returns immediately with a ``job_id`` that can be used to poll
    status and retrieve results.
    """
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "queued",
        "progress": None,
        "error": None,
        "created_at": _now_iso(),
        "completed_at": None,
        "results": None,
    }

    request_dict = request.model_dump(exclude_none=True) if request else {}
    config = build_config(request_dict)

    # Fire and forget -- run in a thread so we don't block the event loop
    asyncio.get_event_loop().create_task(
        asyncio.to_thread(_run_forecast_blocking, job_id, config)
    )

    return JobStatusResponse(
        job_id=job_id,
        status="queued",
        progress=None,
        error=None,
        created_at=_jobs[job_id]["created_at"],
        completed_at=None,
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_status(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = _jobs[job_id]
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        error=job["error"],
        created_at=job["created_at"],
        completed_at=job["completed_at"],
    )


# -- Helper to get completed results or raise ---------------------------------

def _get_results(job_id: str) -> dict[str, Any]:
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = _jobs[job_id]
    if job["status"] == "failed":
        raise HTTPException(status_code=500, detail=f"Job failed: {job['error']}")
    if job["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job is not yet completed (status={job['status']})",
        )
    return job["results"]


# ---------------------------------------------------------------------------
# Result endpoints
# ---------------------------------------------------------------------------

@router.get("/results/{job_id}/summary", response_model=SummaryMetrics)
async def get_summary(
    job_id: str,
    state: str = Query(default="United States", description="State name"),
):
    results = _get_results(job_id)
    if state == "United States":
        return SummaryMetrics(**results["summary"])
    # Compute on-the-fly for a specific state
    metrics = compute_summary_metrics(
        results["gdp_forecast"],
        results["pop_forecast"],
        results["gdp_pc_annual"],
        end_year=int(results["gdp_forecast"]["date"].max().year),
        state=state,
    )
    return SummaryMetrics(**metrics)


@router.get("/results/{job_id}/cagr/states", response_model=list[CAGRRow])
async def get_cagr_states(job_id: str):
    results = _get_results(job_id)
    return [CAGRRow(**r) for r in results["cagr_by_state"]]


@router.get("/results/{job_id}/cagr/industries", response_model=list[CAGRIndustryRow])
async def get_cagr_industries(
    job_id: str,
    state: str = Query(default="United States", description="State name"),
):
    results = _get_results(job_id)
    if state == "United States":
        return [CAGRIndustryRow(**r) for r in results["cagr_by_industry"]]
    # Compute on-the-fly for a specific state
    rows = compute_cagr_by_industry(
        results["gdp_forecast"],
        end_year=int(results["gdp_forecast"]["date"].max().year),
        state=state,
    )
    return [CAGRIndustryRow(**r) for r in rows]


@router.get("/results/{job_id}/charts/stacked-gdp-per-capita", response_model=StackedChartData)
async def get_stacked_chart(
    job_id: str,
    state: str = Query(default="United States", description="State name"),
):
    results = _get_results(job_id)
    data = build_stacked_chart_data(results["gdp_pc_annual"], state=state)
    return StackedChartData(**data)


@router.get("/results/{job_id}/charts/gdp-trends")
async def get_gdp_trends(
    job_id: str,
    state: str = Query(default="United States", description="State name"),
    industries: Optional[str] = Query(
        default=None,
        description="Comma-separated list of industry names",
    ),
):
    results = _get_results(job_id)
    ind_list = [i.strip() for i in industries.split(",")] if industries else None
    data = build_gdp_trends_data(results["gdp_forecast"], state=state, industries=ind_list)
    return data


@router.get("/results/{job_id}/tables/gdp", response_model=PagedResponse)
async def get_gdp_table(
    job_id: str,
    state: Optional[str] = Query(default=None, description="Filter by state"),
    industry: Optional[str] = Query(default=None, description="Filter by industry"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=100, ge=1, le=1000),
):
    results = _get_results(job_id)
    df = results["gdp_forecast"]

    if state:
        df = df[df["state"] == state]
    if industry:
        df = df[df["industry"] == industry]

    df = df.sort_values(["state", "industry", "date"])
    total = len(df)
    start = (page - 1) * per_page
    end = start + per_page
    page_df = df.iloc[start:end]

    page_df = page_df.copy()
    page_df["date"] = page_df["date"].astype(str)
    records = page_df[["quarter", "date", "state", "industry", "real_gdp", "is_forecast"]].to_dict(
        orient="records"
    )

    return PagedResponse(data=records, total=total, page=page, per_page=per_page)


@router.get("/results/{job_id}/tables/gdp-per-capita", response_model=PagedResponse)
async def get_gdp_per_capita_table(
    job_id: str,
    state: Optional[str] = Query(default=None, description="Filter by state"),
    industry: Optional[str] = Query(default=None, description="Filter by industry"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=100, ge=1, le=1000),
):
    results = _get_results(job_id)
    df = results["gdp_pc_annual"]

    if state:
        df = df[df["state"] == state]
    if industry:
        df = df[df["industry"] == industry]

    df = df.sort_values(["state", "industry", "year"])
    total = len(df)
    start = (page - 1) * per_page
    end = start + per_page
    page_df = df.iloc[start:end]

    records = page_df[["year", "state", "industry", "real_gdp", "population", "gdp_per_capita"]].to_dict(
        orient="records"
    )

    return PagedResponse(data=records, total=total, page=page, per_page=per_page)


@router.get("/results/{job_id}/export")
async def export_forecast(job_id: str):
    """Export GDP per capita in wide format from 2010 onward (historical + forecast)."""
    import numpy as np

    results = _get_results(job_id)
    gdp_df = results["gdp_combined"].copy()
    pop_df = results["pop_forecast"].copy()

    # Compute quarterly per-capita
    gdp_df["year"] = gdp_df["date"].dt.year
    merged = gdp_df.merge(
        pop_df[["year", "state", "population"]],
        on=["year", "state"],
        how="left",
    )
    merged["gdp_per_capita"] = np.where(
        merged["population"] > 0,
        (merged["real_gdp"] * 1_000_000) / merged["population"],
        np.nan,
    )

    # Column header: "State_Industry"
    merged["state_industry"] = merged["state"] + "_" + merged["industry"]

    # Pivot to wide: rows = quarters, columns = state_industry
    pivot = merged.pivot_table(
        index="quarter",
        columns="state_industry",
        values="gdp_per_capita",
        aggfunc="first",
    )
    pivot = pivot.sort_index()

    csv_buffer = io.StringIO()
    # Single header row: Quarter, then State_Industry columns
    cols = pivot.columns.tolist()
    csv_buffer.write("Quarter," + ",".join(f'"{c}"' for c in cols) + "\n")
    # Data rows
    for quarter, row in pivot.iterrows():
        vals = [f"{v:.2f}" if pd.notna(v) else "" for v in row]
        csv_buffer.write(f"{quarter}," + ",".join(vals) + "\n")

    csv_buffer.seek(0)
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=gdp_per_capita_forecast_{job_id}.csv"},
    )
