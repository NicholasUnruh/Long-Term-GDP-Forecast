"""FastAPI application for the Long-Term GDP Forecast engine.

Start the server with:
    uvicorn api.main:app --reload
or:
    python -m api.main
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Ensure the project root is on sys.path so ``src.*`` imports work.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import API_HOST, API_PORT, CORS_ORIGINS
from api.routers import forecast as forecast_router
from api.routers import config_router
from api.routers import data as data_router
from api.services.forecast_service import build_config, run_forecast

# Store the baseline results so they're available without an explicit run.
from api.routers.forecast import _jobs, _now_iso

app = FastAPI(
    title="Long-Term GDP Forecast API",
    description=(
        "REST API wrapping a Cobb-Douglas production-function model that "
        "forecasts US real GDP by state and industry from 2025 to 2050."
    ),
    version="1.0.0",
)

# -- CORS --------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routers ------------------------------------------------------------------
app.include_router(forecast_router.router)
app.include_router(config_router.router)
app.include_router(data_router.router)


# -- Root endpoint ------------------------------------------------------------

@app.get("/")
async def root():
    return {"status": "ok"}


# -- Startup: pre-compute baseline in background -----------------------------

def _precompute_baseline(job_id: str) -> None:
    """Run the baseline forecast (blocking, executed in a thread)."""
    _jobs[job_id]["status"] = "running"
    _jobs[job_id]["progress"] = 0
    try:
        config = build_config()
        results = run_forecast(config)
        _jobs[job_id]["results"] = results
        _jobs[job_id]["status"] = "completed"
        _jobs[job_id]["progress"] = 100
        _jobs[job_id]["completed_at"] = _now_iso()
    except Exception as exc:  # noqa: BLE001
        import traceback
        _jobs[job_id]["status"] = "failed"
        _jobs[job_id]["error"] = f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
        _jobs[job_id]["completed_at"] = _now_iso()


@app.on_event("startup")
async def startup_precompute():
    """Pre-compute the baseline scenario so first requests are instant."""
    job_id = "baseline"
    _jobs[job_id] = {
        "status": "queued",
        "progress": None,
        "error": None,
        "created_at": _now_iso(),
        "completed_at": None,
        "results": None,
    }
    asyncio.get_event_loop().create_task(
        asyncio.to_thread(_precompute_baseline, job_id)
    )


# -- CLI entry point ----------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
    )
