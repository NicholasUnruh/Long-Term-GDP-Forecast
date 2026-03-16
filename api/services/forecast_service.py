"""Core forecast service that wraps the existing src/ engine.

All heavy computation is delegated to the modules in ``src/``.  This
service provides a clean interface for the API layer to trigger a
forecast run and extract structured results from the DataFrames that
come back.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the project root is on sys.path so that ``from src.xxx``
# imports work regardless of how the API process was started.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import copy
from typing import Any

import numpy as np
import pandas as pd

from src.utils import (
    load_config,
    apply_scenario,
    LEAF_INDUSTRIES,
    SUB_AGGREGATE_INDUSTRIES,
    AGGREGATE_INDUSTRIES,
)
from src.gdp_forecast import compute_historical_cagr
from src.data_loader import (
    load_gdp_data,
    load_population_data,
    align_state_names,
    get_states,
)
from src.population_forecast import forecast_population, interpolate_to_quarterly
from src.gdp_forecast import run_gdp_forecast
from src.gdp_per_capita import compute_annual_gdp_per_capita


# ---------------------------------------------------------------------------
# Helpers to deep-merge user overrides into the YAML config
# ---------------------------------------------------------------------------

def _deep_merge(base: dict, override: dict) -> dict:
    """Return a new dict that is *base* with *override* applied recursively."""
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def _request_to_overrides(request_dict: dict[str, Any]) -> dict[str, Any]:
    """Convert a ForecastRequest dict (Pydantic model dump) into a flat
    config override dict suitable for ``_deep_merge`` with the YAML config.

    Only non-``None`` top-level sections are included.  The special key
    ``scenario`` is stripped out (handled separately).
    """
    overrides: dict[str, Any] = {}
    for section in (
        "forecast",
        "population",
        "industry",
    ):
        val = request_dict.get(section)
        if val is not None:
            cleaned: dict[str, Any] = {}
            for k, v in val.items():
                if isinstance(v, dict):
                    cleaned[k] = {
                        ik: iv for ik, iv in v.items() if iv is not None
                    } if all(isinstance(iv, dict) for iv in v.values()) else v
                elif v is not None:
                    cleaned[k] = v
            if cleaned:
                overrides[section] = cleaned
    return overrides


# ---------------------------------------------------------------------------
# Main forecast runner
# ---------------------------------------------------------------------------

def build_config(request_dict: dict[str, Any] | None = None) -> dict:
    """Load the default YAML config, optionally apply a named scenario,
    then merge any user-supplied overrides on top.

    Returns the final config dict ready for the forecast engine.
    """
    config = load_config()

    # Apply named scenario first (if provided)
    scenario_name = (request_dict or {}).get("scenario")
    if scenario_name and scenario_name != "baseline":
        config = apply_scenario(config, scenario_name)

    # Merge user overrides on top
    if request_dict:
        overrides = _request_to_overrides(request_dict)
        if overrides:
            config = _deep_merge(config, overrides)

    return config


def run_forecast(config: dict) -> dict[str, Any]:
    """Execute a full forecast run using the provided config dict.

    Returns a dict containing:
        - gdp_forecast   : DataFrame of quarterly GDP forecast
        - pop_forecast    : DataFrame of annual population forecast
        - gdp_pc_annual   : DataFrame of annual GDP per capita
        - summary         : dict of headline metrics
        - cagr_by_state   : list[dict] of CAGR rows per state
        - cagr_by_industry: list[dict] of CAGR rows per industry
    """
    end_year: int = config["forecast"]["end_year"]
    start_q: str = config["forecast"]["start_quarter"]

    # Load raw data
    gdp_df = load_gdp_data()
    pop_df = load_population_data()
    gdp_df, pop_df = align_state_names(gdp_df, pop_df)
    states = get_states(gdp_df, include_us=False)

    # Population forecast
    pop_forecast = forecast_population(pop_df, config, end_year)

    # GDP forecast
    gdp_forecast = run_gdp_forecast(
        gdp_df,
        pop_forecast,
        config,
        states=states,
        industries=LEAF_INDUSTRIES,
        end_year=end_year,
    )

    # GDP per capita (annual) — combine historical + forecast on the fly
    # (we don't store the combined DF to save ~45MB per job)
    historical_gdp = gdp_df[gdp_df["date"].dt.year >= 2010].copy()
    historical_gdp["is_forecast"] = False
    combined_gdp = pd.concat([historical_gdp, gdp_forecast], ignore_index=True)
    gdp_pc_annual = compute_annual_gdp_per_capita(combined_gdp, pop_forecast)
    del combined_gdp  # free the temporary combined DF

    # Derived analytics
    summary = compute_summary_metrics(gdp_forecast, pop_forecast, gdp_pc_annual, end_year)
    cagr_states = compute_cagr_by_state(gdp_forecast, pop_forecast, gdp_pc_annual, end_year)
    cagr_industries = compute_cagr_by_industry(gdp_forecast, end_year)

    return {
        "gdp_forecast": gdp_forecast,
        "pop_forecast": pop_forecast,
        "gdp_pc_annual": gdp_pc_annual,
        "summary": summary,
        "cagr_by_state": cagr_states,
        "cagr_by_industry": cagr_industries,
    }


# ---------------------------------------------------------------------------
# Analytics helpers
# ---------------------------------------------------------------------------

def compute_summary_metrics(
    gdp_forecast: pd.DataFrame,
    pop_forecast: pd.DataFrame,
    gdp_pc_annual: pd.DataFrame,
    end_year: int,
    state: str = "United States",
) -> dict[str, float]:
    """Return headline metrics for the given state (or US) at the start
    and end of the forecast horizon."""

    st_gdp = gdp_forecast[
        (gdp_forecast["state"] == state)
        & (gdp_forecast["industry"] == "All industry total")
    ].sort_values("date")

    gdp_start = float(st_gdp.iloc[0]["real_gdp"]) if len(st_gdp) > 0 else 0.0
    gdp_end = float(st_gdp.iloc[-1]["real_gdp"]) if len(st_gdp) > 0 else 0.0
    n_quarters = len(st_gdp)
    if gdp_start > 0 and n_quarters > 1:
        cagr = (gdp_end / gdp_start) ** (4 / n_quarters) - 1
    else:
        cagr = 0.0

    # Population
    st_pop = pop_forecast[pop_forecast["state"] == state].sort_values("year")
    pop_start = 0.0
    pop_end = 0.0
    if len(st_pop) > 0:
        start_row = st_pop[st_pop["year"] <= 2025]
        if len(start_row) > 0:
            pop_start = float(start_row.iloc[-1]["population"])
        end_row = st_pop[st_pop["year"] == end_year]
        if len(end_row) > 0:
            pop_end = float(end_row.iloc[0]["population"])

    # GDP per capita
    st_pc = gdp_pc_annual[
        (gdp_pc_annual["state"] == state)
        & (gdp_pc_annual["industry"] == "All industry total")
    ].sort_values("year")
    pc_start = float(st_pc.iloc[0]["gdp_per_capita"]) if len(st_pc) > 0 else 0.0
    end_pc = st_pc[st_pc["year"] == end_year]
    pc_end = float(end_pc.iloc[0]["gdp_per_capita"]) if len(end_pc) > 0 else 0.0

    return {
        "us_gdp_2050": gdp_end,
        "us_pop_2050": pop_end,
        "us_gdp_per_capita_2050": pc_end,
        "us_cagr": cagr,
        "us_gdp_start": gdp_start,
        "us_pop_start": pop_start,
        "us_gdp_per_capita_start": pc_start,
    }


def compute_cagr_by_state(
    gdp_forecast: pd.DataFrame,
    pop_forecast: pd.DataFrame,
    gdp_pc_annual: pd.DataFrame,
    end_year: int,
) -> list[dict[str, Any]]:
    """Return a list of CAGR dicts, one per state (excluding 'United States')."""

    us_filter = gdp_forecast["state"] != "United States"
    all_ind = gdp_forecast["industry"] == "All industry total"
    fc = gdp_forecast[us_filter & all_ind].sort_values(["state", "date"])

    rows: list[dict[str, Any]] = []
    for state, grp in fc.groupby("state"):
        grp = grp.sort_values("date")
        if len(grp) < 2:
            continue
        gdp_start = float(grp.iloc[0]["real_gdp"])
        gdp_end = float(grp.iloc[-1]["real_gdp"])
        n_q = len(grp)
        cagr = (gdp_end / gdp_start) ** (4 / n_q) - 1 if gdp_start > 0 else 0.0

        # Population end
        pop_row = pop_forecast[
            (pop_forecast["state"] == state) & (pop_forecast["year"] == end_year)
        ]
        pop_end = float(pop_row.iloc[0]["population"]) if len(pop_row) > 0 else 0.0

        # GDP per capita end
        pc_row = gdp_pc_annual[
            (gdp_pc_annual["state"] == state)
            & (gdp_pc_annual["industry"] == "All industry total")
            & (gdp_pc_annual["year"] == end_year)
        ]
        pc_end = float(pc_row.iloc[0]["gdp_per_capita"]) if len(pc_row) > 0 else 0.0

        rows.append({
            "state": state,
            "gdp_start": gdp_start,
            "gdp_end": gdp_end,
            "gdp_per_capita_end": pc_end,
            "cagr": cagr,
            "population_end": pop_end,
        })

    return sorted(rows, key=lambda r: r["cagr"], reverse=True)


def compute_cagr_by_industry(
    gdp_forecast: pd.DataFrame,
    end_year: int,
    state: str = "United States",
) -> list[dict[str, Any]]:
    """Return a list of CAGR dicts, one per leaf industry, for the given state."""

    st = gdp_forecast[gdp_forecast["state"] == state]
    rows: list[dict[str, Any]] = []

    for industry in LEAF_INDUSTRIES:
        ind_data = st[st["industry"] == industry].sort_values("date")
        if len(ind_data) < 2:
            continue
        gdp_start = float(ind_data.iloc[0]["real_gdp"])
        gdp_end = float(ind_data.iloc[-1]["real_gdp"])
        n_q = len(ind_data)
        cagr = (gdp_end / gdp_start) ** (4 / n_q) - 1 if gdp_start > 0 else 0.0
        rows.append({
            "industry": industry,
            "gdp_start": gdp_start,
            "gdp_end": gdp_end,
            "cagr": cagr,
        })

    return sorted(rows, key=lambda r: r["cagr"], reverse=True)


def build_stacked_chart_data(
    gdp_pc_annual: pd.DataFrame,
    state: str = "United States",
) -> dict[str, Any]:
    """Build stacked chart data for GDP per capita by industry for a
    given state.

    Returns a dict with ``years`` (list[int]) and ``series``
    (dict mapping industry name to list[float]).
    """
    mask = (gdp_pc_annual["state"] == state) & (
        gdp_pc_annual["industry"].isin(LEAF_INDUSTRIES)
    )
    subset = gdp_pc_annual[mask].copy()

    if subset.empty:
        return {"years": [], "series": {}}

    years = sorted(subset["year"].unique())
    series: dict[str, list[float]] = {}
    for industry in LEAF_INDUSTRIES:
        ind_data = subset[subset["industry"] == industry].set_index("year")
        vals: list[float] = []
        for y in years:
            if y in ind_data.index:
                vals.append(float(ind_data.loc[y, "gdp_per_capita"]))
            else:
                vals.append(0.0)
        series[industry] = vals

    return {"years": [int(y) for y in years], "series": series}


def build_gdp_trends_data(
    gdp_forecast: pd.DataFrame,
    state: str = "United States",
    industries: list[str] | None = None,
) -> dict[str, Any]:
    """Return time-series GDP data for a given state and set of industries.

    Returns a dict with ``quarters`` (list[str]) and ``series``
    (dict mapping industry name to list[float]).
    """
    if industries is None:
        industries = ["All industry total"]

    mask = gdp_forecast["state"] == state
    subset = gdp_forecast[mask].copy()

    if subset.empty:
        return {"quarters": [], "series": {}}

    quarters = sorted(subset["quarter"].unique())
    series: dict[str, list[float]] = {}
    for industry in industries:
        ind_data = subset[subset["industry"] == industry].set_index("quarter")
        vals: list[float] = []
        for q in quarters:
            if q in ind_data.index:
                val = ind_data.loc[q, "real_gdp"]
                # Handle potential duplicates
                if isinstance(val, pd.Series):
                    val = val.iloc[0]
                vals.append(float(val))
            else:
                vals.append(0.0)
        series[industry] = vals

    return {"quarters": quarters, "series": series}
