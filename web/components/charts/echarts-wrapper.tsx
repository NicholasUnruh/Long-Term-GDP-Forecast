'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
} from 'echarts/components';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  TitleComponent,
]);

interface Props {
  option: echarts.EChartsCoreOption;
  className?: string;
  height?: string;
  loading?: boolean;
  onEvents?: Record<string, (params: any) => void>;
}

export function EChartsWrapper({ option, className, height = '400px', loading, onEvents }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const getOrCreateInstance = useCallback(() => {
    if (!chartRef.current) return null;
    if (instanceRef.current && !instanceRef.current.isDisposed?.()) {
      return instanceRef.current;
    }
    instanceRef.current = echarts.init(chartRef.current);
    return instanceRef.current;
  }, []);

  // Initialize chart and handle resize
  useEffect(() => {
    const instance = getOrCreateInstance();
    if (!instance || !chartRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (instanceRef.current && !instanceRef.current.isDisposed?.()) {
        instanceRef.current.resize();
      }
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (instanceRef.current && !instanceRef.current.isDisposed?.()) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, [getOrCreateInstance]);

  // Update chart options when they change
  useEffect(() => {
    const instance = getOrCreateInstance();
    if (!instance) return;

    if (loading) {
      instance.showLoading();
    } else {
      instance.hideLoading();
      if (option && Object.keys(option).length > 0) {
        instance.setOption(option, { notMerge: true });
      }
    }
  }, [option, loading, getOrCreateInstance]);

  // Bind event handlers
  useEffect(() => {
    const instance = getOrCreateInstance();
    if (!instance || !onEvents) return;

    for (const [eventName, handler] of Object.entries(onEvents)) {
      instance.on(eventName, handler);
    }

    return () => {
      for (const eventName of Object.keys(onEvents)) {
        instance.off(eventName);
      }
    };
  }, [onEvents, getOrCreateInstance]);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ height, width: '100%' }}
    />
  );
}
