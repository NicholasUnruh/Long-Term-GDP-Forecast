"""Static data endpoints.

GET /data/states      -- list of state names from the GDP dataset
GET /data/industries  -- industry lists (leaf, sub-aggregate, aggregate)
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Query

# Ensure project root is importable
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.utils import LEAF_INDUSTRIES, SUB_AGGREGATE_INDUSTRIES, AGGREGATE_INDUSTRIES
from src.data_loader import load_gdp_data, get_states
from src.gdp_forecast import compute_historical_cagr

router = APIRouter(prefix="/data", tags=["data"])

# Cache the state list so we only parse the CSV once.
_cached_states: list[str] | None = None


def _get_states() -> list[str]:
    global _cached_states
    if _cached_states is None:
        gdp_df = load_gdp_data()
        _cached_states = get_states(gdp_df, include_us=True)
    return _cached_states


@router.get("/states")
async def get_state_list() -> list[str]:
    """Return the list of state names present in the GDP dataset."""
    return _get_states()


@router.get("/industries")
async def get_industry_lists() -> dict[str, Any]:
    """Return the industry hierarchy used by the forecast model."""
    return {
        "leaf_industries": list(LEAF_INDUSTRIES),
        "sub_aggregate_industries": {
            k: list(v) for k, v in SUB_AGGREGATE_INDUSTRIES.items()
        },
        "aggregate_industries": list(AGGREGATE_INDUSTRIES),
    }


@router.get("/historical-range")
async def get_historical_range() -> dict[str, int]:
    """Return the min and max years available in the historical GDP data."""
    gdp_df = load_gdp_data()
    min_year = int(gdp_df["date"].dt.year.min())
    max_year = int(gdp_df["date"].dt.year.max())
    return {"min_year": min_year, "max_year": max_year}


def _compute_cagr_preview(start_year: Optional[int]) -> list[dict[str, Any]]:
    """Compute CAGR for every state-industry pair (blocking, run in thread)."""
    gdp_df = load_gdp_data()
    states = sorted([s for s in gdp_df["state"].unique() if s != "United States"])
    rows: list[dict[str, Any]] = []
    for state in states:
        for industry in LEAF_INDUSTRIES:
            annual, _ = compute_historical_cagr(gdp_df, state, industry, start_year=start_year)
            mask = (gdp_df["state"] == state) & (gdp_df["industry"] == industry)
            subset = gdp_df[mask].sort_values("date")
            base_gdp = float(subset.iloc[-1]["real_gdp"]) if len(subset) > 0 else 0
            rows.append({
                "state": state,
                "industry": industry,
                "annual_cagr": round(annual, 6),
                "base_gdp": round(base_gdp, 2),
            })
    rows.sort(key=lambda r: abs(r["annual_cagr"]), reverse=True)
    return rows


@router.get("/cagr-preview")
async def get_cagr_preview(
    start_year: Optional[int] = Query(
        default=None,
        ge=2005,
        le=2024,
        description="Historical range start year. null = use all available data.",
    ),
) -> list[dict[str, Any]]:
    """Return CAGR for all state-industry pairs, sorted by absolute value.

    Used by the configure page to preview growth rates and identify outliers
    before running a forecast.
    """
    return await asyncio.to_thread(_compute_cagr_preview, start_year)
