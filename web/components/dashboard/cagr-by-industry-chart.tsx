'use client';

import { useMemo } from 'react';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INDUSTRY_COLORS, INDUSTRY_SHORT_NAMES } from '@/lib/constants';
import type { CAGRIndustryRow } from '@/lib/types';

interface Props {
  data: CAGRIndustryRow[] | undefined;
  isLoading: boolean;
  state?: string;
}

export function CAGRByIndustryChart({ data, isLoading, state = 'United States' }: Props) {
  const option = useMemo(() => {
    if (!data || data.length === 0) return {};

    // Sort by CAGR ascending so highest is at top of horizontal bar chart
    const sorted = [...data].sort((a, b) => a.cagr - b.cagr);

    const categories = sorted.map(
      (row) => INDUSTRY_SHORT_NAMES[row.industry] || row.industry
    );
    const values = sorted.map((row) => row.cagr * 100);
    const colors = sorted.map(
      (row) => INDUSTRY_COLORS[row.industry] || '#888'
    );

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `<div style="font-weight:600">${p.name}</div>
            <div>CAGR: ${p.value.toFixed(2)}%</div>`;
        },
      },
      grid: {
        left: 140,
        right: 80,
        top: 10,
        bottom: 10,
      },
      xAxis: {
        type: 'value',
        name: 'CAGR (%)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: (v: number) => `${v.toFixed(1)}%`,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          fontSize: 11,
          width: 120,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] },
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) => `${params.value.toFixed(2)}%`,
            fontSize: 11,
          },
          barWidth: '60%',
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
    };
  }, [data]);

  const chartHeight = data ? Math.max(400, data.length * 28) : 400;

  return (
    <Card>
      <CardHeader>
        <CardTitle>CAGR by Industry ({state === 'United States' ? 'US Total' : state})</CardTitle>
        <CardDescription>
          Compound annual growth rate by industry from forecast start to 2050
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="w-full h-[500px]" />
        ) : (
          <EChartsWrapper
            option={option}
            height={`${chartHeight}px`}
            loading={isLoading}
          />
        )}
      </CardContent>
    </Card>
  );
}
