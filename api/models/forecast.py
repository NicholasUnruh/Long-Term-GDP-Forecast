from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ForecastHorizon(BaseModel):
    start_quarter: str = Field(
        default="2025:Q4",
        description="First projected quarter, e.g. '2025:Q4'",
    )
    end_year: int = Field(
        default=2050,
        ge=2026,
        le=2100,
        description="Final year of the projection",
    )
    historical_range_start_year: Optional[int] = Field(
        default=None,
        ge=2005,
        le=2024,
        description="Start year for historical CAGR computation. null = use all available data (2005+).",
    )
    cagr_cap: Optional[float] = Field(
        default=0,
        ge=0.0,
        le=0.20,
        description="Maximum annual CAGR (absolute value) per state-industry. Caps extreme outliers. 0 = no cap.",
    )
    cagr_overrides: dict[str, float] = Field(
        default_factory=dict,
        description="Per state-industry CAGR caps. Keys are 'State|Industry', values are max annual CAGR. Overrides the global cagr_cap for specific pairs.",
    )


class PopulationConfig(BaseModel):
    fit_start_year: int = Field(
        default=2010,
        description="Compute recent CAGR from this year onward",
    )
    national_pop_target: Optional[int] = Field(
        default=370_000_000,
        description="Target US population for the end year (default 370M based on Census/Cooper Center consensus)",
    )
    growth_deceleration: float = Field(
        default=0.04,
        description="Annual decay rate for population growth (controls how quickly growth slows)",
    )
    share_damping: float = Field(
        default=0.03,
        description="Annual damping of state-level growth differentials",
    )
    by_state: dict[str, float] = Field(
        default_factory=dict,
        description="State-specific CAGR overrides (annual growth rate)",
    )


class IndustryConfig(BaseModel):
    structural_shift: bool = Field(
        default=True,
        description="Enable industry structural shifts",
    )
    shift_rates: dict[str, float] = Field(
        default_factory=dict,
        description="Per-industry annual share shift rates",
    )


class ForecastRequest(BaseModel):
    """Request body for running a forecast.

    All fields are optional.  When a field is ``None`` the corresponding
    default value from the YAML config file is used instead.
    """

    scenario: Optional[str] = Field(
        default=None,
        description=(
            "Named scenario to apply before custom overrides. "
            "One of: baseline, high_growth, low_growth, ai_boom"
        ),
    )
    forecast: Optional[ForecastHorizon] = None
    population: Optional[PopulationConfig] = None
    industry: Optional[IndustryConfig] = None
