export interface SummaryMetrics {
  us_gdp_2050: number;
  us_pop_2050: number;
  us_gdp_per_capita_2050: number;
  us_cagr: number;
  us_gdp_start: number;
  us_pop_start: number;
  us_gdp_per_capita_start: number;
}

export interface CAGRRow {
  state: string;
  gdp_start: number;
  gdp_end: number;
  gdp_per_capita_end: number;
  cagr: number;
  population_end: number;
}

export interface CAGRIndustryRow {
  industry: string;
  gdp_start: number;
  gdp_end: number;
  cagr: number;
}

export interface StackedChartData {
  years: number[];
  series: Record<string, number[]>;
}

export interface GDPTrendsData {
  quarters: string[];
  series: Record<string, number[]>;
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface GDPRecord {
  quarter: string;
  date: string;
  state: string;
  industry: string;
  real_gdp: number;
  is_forecast: boolean;
}

export interface GDPPerCapitaRecord {
  year: number;
  state: string;
  industry: string;
  real_gdp: number;
  population: number;
  gdp_per_capita: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ForecastConfig {
  forecast: {
    start_quarter: string;
    end_year: number;
    historical_range_start_year: number | null;
    short_term_years: number;
    short_term_start_year: number;
    cagr_cap: number;
    cagr_overrides: Record<string, number>;
    growth_modes: Record<string, string>;
  };
  population: {
    fit_start_year: number;
    national_pop_target: number;
    growth_deceleration: number;
    share_damping: number;
    by_state: Record<string, number>;
  };
  industry: {
    structural_shift: boolean;
    shift_rates: Record<string, number>;
  };
}

export interface ForecastRequest {
  scenario?: string;
  forecast?: Partial<ForecastConfig['forecast']>;
  population?: Partial<ForecastConfig['population']>;
  industry?: Partial<ForecastConfig['industry']>;
}
