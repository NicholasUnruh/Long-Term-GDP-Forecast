"""Configuration endpoints.

GET /config/defaults   -- full default YAML config
GET /config/scenarios  -- available scenario names and their overrides
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

from src.utils import load_config

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/defaults")
async def get_defaults() -> dict[str, Any]:
    """Return the full default configuration from the YAML file."""
    config = load_config()
    return config


@router.get("/scenarios")
async def get_scenarios() -> dict[str, Any]:
    """Return the available scenario names and their parameter overrides."""
    config = load_config()
    scenarios = config.get("scenarios", {})
    return scenarios
