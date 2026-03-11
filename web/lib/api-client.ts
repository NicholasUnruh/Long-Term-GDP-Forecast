const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

// Config endpoints
export const getDefaults = () => fetchAPI<Record<string, any>>('/config/defaults');
export const getScenarios = () => fetchAPI<Record<string, any>>('/config/scenarios');

// Data endpoints
export const getStates = () => fetchAPI<string[]>('/data/states');
export const getIndustries = () => fetchAPI<{
  leaf: string[];
  sub_aggregate: Record<string, string[]>;
  aggregate: string[];
}>('/data/industries');

// Forecast endpoints
import type { ForecastRequest, JobStatus, SummaryMetrics, CAGRRow, CAGRIndustryRow, StackedChartData, GDPTrendsData, PagedResponse, GDPRecord, GDPPerCapitaRecord } from './types';

export const runForecast = (config: ForecastRequest) =>
  fetchAPI<{ job_id: string }>('/forecast/run', {
    method: 'POST',
    body: JSON.stringify(config),
  });

export const getJobStatus = (jobId: string) =>
  fetchAPI<JobStatus>(`/forecast/status/${jobId}`);

export const getSummary = (jobId: string, state: string = 'United States') =>
  fetchAPI<SummaryMetrics>(`/forecast/results/${jobId}/summary?state=${encodeURIComponent(state)}`);

export const getCAGRByState = (jobId: string) =>
  fetchAPI<CAGRRow[]>(`/forecast/results/${jobId}/cagr/states`);

export const getCAGRByIndustry = (jobId: string, state: string = 'United States') =>
  fetchAPI<CAGRIndustryRow[]>(`/forecast/results/${jobId}/cagr/industries?state=${encodeURIComponent(state)}`);

export const getStackedGDPPerCapita = (jobId: string, state: string) =>
  fetchAPI<StackedChartData>(`/forecast/results/${jobId}/charts/stacked-gdp-per-capita?state=${encodeURIComponent(state)}`);

export const getGDPTrends = (jobId: string, state: string, industries: string[]) =>
  fetchAPI<GDPTrendsData>(`/forecast/results/${jobId}/charts/gdp-trends?state=${encodeURIComponent(state)}&industries=${industries.map(i => encodeURIComponent(i)).join(',')}`);

export const getGDPTable = (jobId: string, params: { state?: string; industry?: string; page?: number; per_page?: number }) => {
  const searchParams = new URLSearchParams();
  if (params.state) searchParams.set('state', params.state);
  if (params.industry) searchParams.set('industry', params.industry);
  searchParams.set('page', String(params.page || 1));
  searchParams.set('per_page', String(params.per_page || 100));
  return fetchAPI<PagedResponse<GDPRecord>>(`/forecast/results/${jobId}/tables/gdp?${searchParams}`);
};

export const getGDPPerCapitaTable = (jobId: string, params: { state?: string; industry?: string; page?: number; per_page?: number }) => {
  const searchParams = new URLSearchParams();
  if (params.state) searchParams.set('state', params.state);
  if (params.industry) searchParams.set('industry', params.industry);
  searchParams.set('page', String(params.page || 1));
  searchParams.set('per_page', String(params.per_page || 100));
  return fetchAPI<PagedResponse<GDPPerCapitaRecord>>(`/forecast/results/${jobId}/tables/gdp-per-capita?${searchParams}`);
};
