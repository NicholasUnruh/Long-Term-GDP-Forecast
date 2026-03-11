'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGDP, formatPopulation, formatPercent, formatPerCapita } from '@/lib/formatters';
import type { SummaryMetrics as SummaryMetricsType } from '@/lib/types';
import { TrendingUp, TrendingDown, DollarSign, Users, BarChart3, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  summary: SummaryMetricsType | undefined;
  isLoading: boolean;
  state?: string;
}

function MetricSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function ChangeIndicator({ startValue, endValue, format }: { startValue: number; endValue: number; format: 'gdp' | 'population' | 'percapita' | 'percent' }) {
  const pctChange = ((endValue - startValue) / startValue) * 100;
  const isPositive = pctChange >= 0;

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-red-600')}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{isPositive ? '+' : ''}{pctChange.toFixed(1)}% from start</span>
    </div>
  );
}

export function SummaryMetricsCards({ summary, isLoading, state = 'United States' }: Props) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
    );
  }

  const label = state === 'United States' ? 'US' : state;

  const metrics = [
    {
      title: `${label} GDP 2050`,
      value: formatGDP(summary.us_gdp_2050),
      icon: DollarSign,
      startValue: summary.us_gdp_start,
      endValue: summary.us_gdp_2050,
      format: 'gdp' as const,
    },
    {
      title: `${label} Population 2050`,
      value: formatPopulation(summary.us_pop_2050),
      icon: Users,
      startValue: summary.us_pop_start,
      endValue: summary.us_pop_2050,
      format: 'population' as const,
    },
    {
      title: 'GDP per Capita 2050',
      value: formatPerCapita(summary.us_gdp_per_capita_2050),
      icon: BarChart3,
      startValue: summary.us_gdp_per_capita_start,
      endValue: summary.us_gdp_per_capita_2050,
      format: 'percapita' as const,
    },
    {
      title: `${label} CAGR`,
      value: formatPercent(summary.us_cagr),
      icon: Percent,
      startValue: 0,
      endValue: summary.us_cagr,
      format: 'percent' as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            {metric.format !== 'percent' ? (
              <ChangeIndicator
                startValue={metric.startValue}
                endValue={metric.endValue}
                format={metric.format}
              />
            ) : (
              <div className={cn('flex items-center gap-1 text-xs font-medium', metric.endValue >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {metric.endValue >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>Compound annual growth rate</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
