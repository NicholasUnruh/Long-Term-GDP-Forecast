"""Static data endpoints.

GET /data/states      -- list of state names from the GDP dataset
GET /data/industries  -- industry lists (leaf, sub-aggregate, aggregate)
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter

# Ensure project root is importable
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.utils import LEAF_INDUSTRIES, SUB_AGGREGATE_INDUSTRIES, AGGREGATE_INDUSTRIES
from src.data_loader import load_gdp_data, get_states

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
