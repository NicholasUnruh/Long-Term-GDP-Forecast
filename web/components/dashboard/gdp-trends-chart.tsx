'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INDUSTRY_COLORS, INDUSTRY_SHORT_NAMES } from '@/lib/constants';
import { formatGDP } from '@/lib/formatters';
import type { GDPTrendsData } from '@/lib/types';

interface Props {
  data: GDPTrendsData | undefined;
  isLoading: boolean;
  isError?: boolean;
  state: string;
  selectedIndustries?: string[];
}

const FALLBACK_COLORS = [
  '#1565C0', '#E53935', '#2E7D32', '#F4511E', '#6A1B9A',
  '#00838F', '#AD1457', '#4E342E', '#283593', '#1B5E20',
];

export function GDPTrendsChart({ data, isLoading, isError, state, selectedIndustries }: Props) {
  const option = useMemo(() => {
    if (!data || !data.quarters.length) return {};

    const seriesNames = Object.keys(data.series);

    const series = seriesNames.map((name, i) => ({
      name: INDUSTRY_SHORT_NAMES[name] || name,
      type: 'line' as const,
      data: data.series[name],
      symbol: 'none',
      lineStyle: { width: 2 },
      itemStyle: {
        color: INDUSTRY_COLORS[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      },
      emphasis: { focus: 'series' as const },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const quarter = params[0].axisValue;
          let html = `<div style="font-weight:600;margin-bottom:4px">${quarter}</div>`;
          for (const p of params) {
            html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px">`;
            html += `<span>${p.marker} ${p.seriesName}</span>`;
            html += `<span style="font-weight:500">${formatGDP(p.value)}</span>`;
            html += `</div>`;
          }
          return html;
        },
        confine: true,
      },
      legend: {
        type: 'scroll',
        bottom: 50,
        textStyle: { fontSize: 11 },
      },
      grid: {
        left: 70,
        right: 30,
        top: 20,
        bottom: 100,
      },
      xAxis: {
        type: 'category',
        data: data.quarters,
        boundaryGap: false,
        axisLabel: {
          fontSize: 10,
          rotate: 45,
          interval: 'auto',
        },
      },
      yAxis: {
        type: 'value',
        name: 'Real GDP (millions $)',
        nameLocation: 'middle',
        nameGap: 55,
        axisLabel: {
          formatter: (value: number) => formatGDP(value),
          fontSize: 11,
        },
      },
      dataZoom: [
        {
          type: 'slider',
          bottom: 10,
          height: 24,
          start: 0,
          end: 100,
        },
        {
          type: 'inside',
        },
      ],
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Save',
            pixelRatio: 2,
          },
        },
        right: 16,
        top: -6,
      },
      series,
    };
  }, [data]);

  const description = useMemo(() => {
    if (!selectedIndustries || selectedIndustries.length === 0) return `GDP over time for ${state}`;
    if (selectedIndustries.length === 1) {
      const name = INDUSTRY_SHORT_NAMES[selectedIndustries[0]] || selectedIndustries[0];
      return `GDP over time for ${state} — ${name}`;
    }
    return `GDP over time for ${state} — ${selectedIndustries.length} industries`;
  }, [state, selectedIndustries]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>GDP Trends</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex items-center justify-center h-[500px] text-muted-foreground">
            Failed to load chart data
          </div>
        ) : isLoading || !data ? (
          <Skeleton className="w-full h-[500px]" />
        ) : (
          <EChartsWrapper option={option} height="500px" loading={isLoading} />
        )}
      </CardContent>
    </Card>
  );
}
