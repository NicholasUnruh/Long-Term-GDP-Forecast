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
  };
  production_function: {
    alpha: number;
    depreciation_rate: number;
  };
  tfp: {
    national_growth_rate: number;
    by_industry: Record<string, number>;
    by_state: Record<string, number>;
    convergence_rate: number;
  };
  capital: {
    investment_to_gdp_ratio: number;
    capital_output_ratio: number;
    capex_growth_adjustment: number;
    by_industry: Record<string, { investment_ratio: number; alpha: number }>;
  };
  labor: {
    lfpr_trend: number;
    working_age_share_trend: number;
    natural_unemployment_rate: number;
    hours_growth: number;
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
  production_function?: Partial<ForecastConfig['production_function']>;
  tfp?: Partial<ForecastConfig['tfp']>;
  capital?: Partial<ForecastConfig['capital']>;
  labor?: Partial<ForecastConfig['labor']>;
  population?: Partial<ForecastConfig['population']>;
  industry?: Partial<ForecastConfig['industry']>;
}
