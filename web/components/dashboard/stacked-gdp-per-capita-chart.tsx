'use client';

import { useMemo, useRef } from 'react';
import { EChartsWrapper } from '@/components/charts/echarts-wrapper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { INDUSTRY_COLORS, INDUSTRY_SHORT_NAMES, LEAF_INDUSTRIES } from '@/lib/constants';
import { formatPerCapita } from '@/lib/formatters';
import type { StackedChartData } from '@/lib/types';

interface Props {
  data: StackedChartData | undefined;
  isLoading: boolean;
  state: string;
}

export function StackedGDPPerCapitaChart({ data, isLoading, state }: Props) {
  const hoveredSeriesRef = useRef<string | null>(null);

  const onEvents = useMemo(() => ({
    mouseover: (params: any) => {
      if (params.seriesName) {
        hoveredSeriesRef.current = params.seriesName;
      }
    },
    mouseout: () => {
      hoveredSeriesRef.current = null;
    },
  }), []);

  const option = useMemo(() => {
    if (!data || !data.years.length) return {};

    // Sort industries by their total contribution (largest at bottom of stack)
    const industryTotals: { industry: string; total: number }[] = [];
    for (const industry of LEAF_INDUSTRIES) {
      const values = data.series[industry];
      if (values) {
        const total = values.reduce((sum, v) => sum + v, 0);
        industryTotals.push({ industry, total });
      }
    }
    industryTotals.sort((a, b) => b.total - a.total);

    const series = industryTotals.map(({ industry }) => ({
      name: INDUSTRY_SHORT_NAMES[industry] || industry,
      type: 'line' as const,
      stack: 'total',
      areaStyle: { opacity: 0.85 },
      emphasis: {
        focus: 'series' as const,
        blurScope: 'coordinateSystem' as const,
        areaStyle: { opacity: 1 },
        lineStyle: { width: 2 },
      },
      blur: {
        areaStyle: { opacity: 0.08 },
        lineStyle: { opacity: 0.08 },
      },
      triggerLineEvent: true,
      symbol: 'none',
      lineStyle: { width: 0.5 },
      data: data.series[industry] || [],
      itemStyle: {
        color: INDUSTRY_COLORS[industry] || '#888',
      },
    }));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params: any[]) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const year = params[0].axisValue;
          const total = params.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
          const hovered = hoveredSeriesRef.current;

          // Sort by value descending
          const sorted = [...params]
            .filter((p: any) => p.value && p.value > 0)
            .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

          const hoveredItem = hovered
            ? sorted.find((p: any) => p.seriesName === hovered)
            : null;

          let html = `<div style="min-width:250px">`;

          // Show hovered industry prominently at top
          if (hoveredItem) {
            const pct = total > 0 ? ((hoveredItem.value / total) * 100).toFixed(1) : '0.0';
            html += `<div style="background:#f0f7ff;border-radius:4px;padding:6px 8px;margin-bottom:6px">`;
            html += `<div style="font-weight:700;font-size:14px;margin-bottom:2px">${hoveredItem.marker} ${hoveredItem.seriesName}</div>`;
            html += `<div style="display:flex;justify-content:space-between;font-size:12px">`;
            html += `<span>${formatPerCapita(hoveredItem.value)}</span>`;
            html += `<span style="font-weight:600">${pct}% of total</span>`;
            html += `</div></div>`;
          }

          // Year + total header
          html += `<div style="font-weight:700;font-size:13px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #e5e5e5">`;
          html += `${year} &mdash; Total: ${formatPerCapita(total)}</div>`;

          // Remaining industries (skip hovered one)
          const others = hoveredItem
            ? sorted.filter((p: any) => p.seriesName !== hovered)
            : sorted;
          const shown = others.slice(0, hoveredItem ? 9 : 10);
          const rest = others.slice(shown.length);

          for (const p of shown) {
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0.0';
            html += `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:1px 0;font-size:12px">`;
            html += `<span style="white-space:nowrap">${p.marker} ${p.seriesName}</span>`;
            html += `<span style="white-space:nowrap">${formatPerCapita(p.value)} <span style="color:#999">(${pct}%)</span></span>`;
            html += `</div>`;
          }

          if (rest.length > 0) {
            const restTotal = rest.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
            const restPct = total > 0 ? ((restTotal / total) * 100).toFixed(1) : '0.0';
            html += `<div style="display:flex;justify-content:space-between;gap:12px;padding:2px 0;font-size:11px;color:#999;border-top:1px solid #f0f0f0;margin-top:2px;padding-top:4px">`;
            html += `<span>+ ${rest.length} more</span>`;
            html += `<span>${formatPerCapita(restTotal)} (${restPct}%)</span>`;
            html += `</div>`;
          }

          html += `</div>`;
          return html;
        },
        confine: true,
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 0,
        top: 20,
        bottom: 60,
        textStyle: { fontSize: 12 },
        itemWidth: 18,
        itemHeight: 12,
        itemGap: 6,
        pageIconSize: 14,
        pageTextStyle: { fontSize: 12 },
      },
      grid: {
        left: 60,
        right: 185,
        top: 20,
        bottom: 80,
      },
      xAxis: {
        type: 'category',
        data: data.years.map(String),
        boundaryGap: false,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'GDP per Capita ($)',
        nameLocation: 'middle',
        nameGap: 50,
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            return `$${value}`;
          },
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>GDP per Capita by Industry</CardTitle>
        <CardDescription>
          Historical (from 2010) and forecast per-capita GDP contribution by industry for {state}. Hover an area to identify it; click a legend item to isolate it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="w-full h-[500px]" />
        ) : (
          <EChartsWrapper option={option} height="500px" loading={isLoading} onEvents={onEvents} />
        )}
      </CardContent>
    </Card>
  );
}
