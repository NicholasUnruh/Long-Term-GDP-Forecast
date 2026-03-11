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


class ProductionFunction(BaseModel):
    alpha: float = Field(
        default=0.30,
        ge=0.10,
        le=0.60,
        description="Capital share of output",
    )
    depreciation_rate: float = Field(
        default=0.05,
        ge=0.01,
        le=0.15,
        description="Annual depreciation rate",
    )


class TFPConfig(BaseModel):
    national_growth_rate: float = Field(
        default=0.010,
        description="Baseline annual TFP growth rate",
    )
    by_industry: dict[str, float] = Field(
        default_factory=dict,
        description="Industry-specific TFP overrides",
    )
    by_state: dict[str, float] = Field(
        default_factory=dict,
        description="State-specific TFP overrides",
    )
    convergence_rate: float = Field(
        default=0.02,
        description="Speed at which lagging states converge",
    )


class CapitalByIndustry(BaseModel):
    investment_ratio: float = Field(
        description="Share of industry GDP reinvested in capital",
    )
    alpha: float = Field(
        description="Industry-specific capital share",
    )


class CapitalConfig(BaseModel):
    investment_to_gdp_ratio: float = Field(
        default=0.20,
        description="Share of GDP that goes to investment",
    )
    capital_output_ratio: float = Field(
        default=3.0,
        description="K/Y ratio (capital per unit of GDP)",
    )
    capex_growth_adjustment: float = Field(
        default=0.0,
        description="Extra annual boost/drag on investment",
    )
    by_industry: dict[str, CapitalByIndustry] = Field(
        default_factory=dict,
        description="Industry-specific capital parameters",
    )


class LaborConfig(BaseModel):
    lfpr_trend: float = Field(
        default=-0.001,
        description="Labor force participation rate change per year",
    )
    working_age_share_trend: float = Field(
        default=-0.002,
        description="Change in 15-64 age group share per year",
    )
    natural_unemployment_rate: float = Field(
        default=0.04,
        description="Long-run unemployment rate",
    )
    hours_growth: float = Field(
        default=0.0,
        description="Annual change in average hours worked per worker",
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
    production_function: Optional[ProductionFunction] = None
    tfp: Optional[TFPConfig] = None
    capital: Optional[CapitalConfig] = None
    labor: Optional[LaborConfig] = None
    population: Optional[PopulationConfig] = None
    industry: Optional[IndustryConfig] = None
