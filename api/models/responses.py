from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: Optional[int] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class SummaryMetrics(BaseModel):
    us_gdp_2050: float = Field(description="US GDP in 2050 (millions of chained 2017 dollars)")
    us_pop_2050: float = Field(description="US population in 2050")
    us_gdp_per_capita_2050: float = Field(description="US GDP per capita in 2050")
    us_cagr: float = Field(description="US GDP compound annual growth rate over forecast horizon")
    us_gdp_start: float = Field(description="US GDP at forecast start (millions)")
    us_pop_start: float = Field(description="US population at forecast start")
    us_gdp_per_capita_start: float = Field(description="US GDP per capita at forecast start")


class CAGRRow(BaseModel):
    state: str
    gdp_start: float
    gdp_end: float
    gdp_per_capita_end: float
    cagr: float
    population_end: float


class CAGRIndustryRow(BaseModel):
    industry: str
    gdp_start: float
    gdp_end: float
    cagr: float


class StackedChartData(BaseModel):
    years: list[int]
    series: dict[str, list[float]] = Field(
        description="Mapping of industry name to list of values aligned with years",
    )


class PagedResponse(BaseModel):
    data: list[dict[str, Any]]
    total: int
    page: int
    per_page: int
