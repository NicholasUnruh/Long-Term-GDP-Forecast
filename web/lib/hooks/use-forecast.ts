'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as api from '../api-client';
import type { ForecastRequest } from '../types';

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['job-status', jobId],
    queryFn: () => api.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000;
    },
  });
}

export function useRunForecast() {
  return useMutation({
    mutationFn: (config: ForecastRequest) => api.runForecast(config),
  });
}

export function useSummary(jobId: string | null, state: string = 'United States') {
  return useQuery({
    queryKey: ['summary', jobId, state],
    queryFn: () => api.getSummary(jobId!, state),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useCAGRByState(jobId: string | null) {
  return useQuery({
    queryKey: ['cagr-states', jobId],
    queryFn: () => api.getCAGRByState(jobId!),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useCAGRByIndustry(jobId: string | null, state: string = 'United States') {
  return useQuery({
    queryKey: ['cagr-industries', jobId, state],
    queryFn: () => api.getCAGRByIndustry(jobId!, state),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useStackedGDPPerCapita(jobId: string | null, state: string) {
  return useQuery({
    queryKey: ['stacked-gdp-pc', jobId, state],
    queryFn: () => api.getStackedGDPPerCapita(jobId!, state),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useGDPTrends(jobId: string | null, state: string, industries: string[]) {
  return useQuery({
    queryKey: ['gdp-trends', jobId, state, industries],
    queryFn: () => api.getGDPTrends(jobId!, state, industries),
    enabled: !!jobId && industries.length > 0,
    staleTime: Infinity,
  });
}

export function useGDPTable(jobId: string | null, params: { state?: string; industry?: string; page?: number; per_page?: number }) {
  return useQuery({
    queryKey: ['gdp-table', jobId, params],
    queryFn: () => api.getGDPTable(jobId!, params),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}

export function useGDPPerCapitaTable(jobId: string | null, params: { state?: string; industry?: string; page?: number; per_page?: number }) {
  return useQuery({
    queryKey: ['gdp-pc-table', jobId, params],
    queryFn: () => api.getGDPPerCapitaTable(jobId!, params),
    enabled: !!jobId,
    staleTime: Infinity,
  });
}
