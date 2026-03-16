'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { SliderWithInput } from '@/components/configure/slider-with-input';
import { LEAF_INDUSTRIES, INDUSTRY_SHORT_NAMES, SCENARIOS, SCENARIO_LABELS } from '@/lib/constants';
import { formatPercent, formatGDP } from '@/lib/formatters';
import { getDefaults, getScenarios, runForecast, getJobStatus, getCAGRPreview } from '@/lib/api-client';
import type { CAGRPreviewRow } from '@/lib/api-client';
import type { ForecastConfig, ForecastRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  RotateCcw,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
  Settings2,
} from 'lucide-react';

// ─── US States List ──────────────────────────────────────────────────────────
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// ─── Deep Clone ──────────────────────────────────────────────────────────────
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Deep Merge ──────────────────────────────────────────────────────────────
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Default Config ──────────────────────────────────────────────────────────
function getDefaultConfig(): ForecastConfig {
  return {
    forecast: {
      start_quarter: '2025:Q4',
      end_year: 2050,
      historical_range_start_year: null,
      short_term_years: 0,
      short_term_start_year: 2015,
      cagr_cap: 0,
      cagr_overrides: {},
    },
    population: {
      fit_start_year: 2010,
      national_pop_target: 370000000,
      growth_deceleration: 0.04,
      share_damping: 0.03,
      by_state: {},
    },
    industry: {
      structural_shift: true,
      shift_rates: {},
    },
  };
}

// ─── Count modified parameters ───────────────────────────────────────────────
function countModified(current: any, defaults: any, prefix = ''): number {
  let count = 0;
  if (defaults === null || defaults === undefined) {
    if (current !== null && current !== undefined) count++;
    return count;
  }
  if (typeof current !== 'object' || current === null) {
    if (typeof defaults !== 'object' || defaults === null) {
      if (typeof current === 'number' && typeof defaults === 'number') {
        if (Math.abs(current - defaults) > 1e-10) count++;
      } else if (current !== defaults) {
        count++;
      }
    }
    return count;
  }
  const allKeys = new Set([...Object.keys(current || {}), ...Object.keys(defaults || {})]);
  for (const key of allKeys) {
    count += countModified(
      current?.[key],
      defaults?.[key],
      prefix ? `${prefix}.${key}` : key
    );
  }
  return count;
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          <Separator className="mb-3" />
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Percent Input (for inline fields that store raw decimals) ──────────────
function PercentInput({
  value,
  onChange,
  step = 0.1,
  decimals = 1,
  className,
}: {
  value: number;
  onChange: (rawValue: number) => void;
  step?: number;
  decimals?: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={parseFloat((value * 100).toFixed(decimals))}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v / 100);
        }}
        step={step}
        className={cn("h-7 text-xs text-center tabular-nums", className)}
      />
      <span className="text-[10px] text-muted-foreground shrink-0">%</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ConfigurePage() {
  const router = useRouter();

  // ── State ────────────────────────────────────────────────────────────────
  const [config, setConfig] = React.useState<ForecastConfig>(getDefaultConfig);
  const [defaults, setDefaults] = React.useState<ForecastConfig>(getDefaultConfig);
  const [scenarios, setScenariosData] = React.useState<Record<string, any>>({});
  const [selectedScenario, setSelectedScenario] = React.useState<string>('baseline');
  const [loading, setLoading] = React.useState(true);
  const [runDialogOpen, setRunDialogOpen] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [jobStatus, setJobStatusState] = React.useState<string>('');
  const [jobError, setJobError] = React.useState<string | null>(null);

  // State override management
  const [newPopState, setNewPopState] = React.useState('');

  // CAGR preview
  const [cagrPreview, setCagrPreview] = React.useState<CAGRPreviewRow[]>([]);
  const [cagrLoading, setCagrLoading] = React.useState(false);
  const [cagrShowAll, setCagrShowAll] = React.useState(false);

  // ── Fetch defaults & scenarios on mount ──────────────────────────────────
  React.useEffect(() => {
    async function load() {
      try {
        const [defaultsData, scenariosResp] = await Promise.all([
          getDefaults(),
          getScenarios(),
        ]);

        const mergedDefaults = deepMerge(getDefaultConfig(), defaultsData) as ForecastConfig;
        setDefaults(mergedDefaults);
        setConfig(deepClone(mergedDefaults));
        setScenariosData(scenariosResp);
      } catch {
        console.warn('Could not fetch defaults from API, using fallback defaults');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const modifiedCount = React.useMemo(
    () => countModified(config, defaults),
    [config, defaults]
  );

  // ── Fetch CAGR preview when historical range changes ─────────────────────
  React.useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setCagrLoading(true);
    const startYear = config.forecast.historical_range_start_year;
    getCAGRPreview(startYear)
      .then((rows) => {
        if (!cancelled) setCagrPreview(rows);
      })
      .catch(() => {
        if (!cancelled) setCagrPreview([]);
      })
      .finally(() => {
        if (!cancelled) setCagrLoading(false);
      });
    return () => { cancelled = true; };
  }, [config.forecast.historical_range_start_year, loading]);

  // ── Updater helpers ──────────────────────────────────────────────────────
  function updateForecast(field: keyof ForecastConfig['forecast'], value: any) {
    setConfig(prev => ({
      ...prev,
      forecast: { ...prev.forecast, [field]: value },
    }));
  }

  function updatePopulation(field: keyof ForecastConfig['population'], value: any) {
    setConfig(prev => ({
      ...prev,
      population: { ...prev.population, [field]: value },
    }));
  }

  function updateIndustry(field: keyof ForecastConfig['industry'], value: any) {
    setConfig(prev => ({
      ...prev,
      industry: { ...prev.industry, [field]: value },
    }));
  }

  // ── CAGR per-pair override helpers ───────────────────────────────────────
  function setCagrOverride(state: string, industry: string, value: number) {
    const key = `${state}|${industry}`;
    setConfig(prev => ({
      ...prev,
      forecast: {
        ...prev.forecast,
        cagr_overrides: { ...prev.forecast.cagr_overrides, [key]: value },
      },
    }));
  }

  function removeCagrOverride(state: string, industry: string) {
    const key = `${state}|${industry}`;
    setConfig(prev => {
      const overrides = { ...prev.forecast.cagr_overrides };
      delete overrides[key];
      return { ...prev, forecast: { ...prev.forecast, cagr_overrides: overrides } };
    });
  }

  // ── Population state override helpers ────────────────────────────────────
  function setPopStateOverride(state: string, value: number) {
    setConfig(prev => ({
      ...prev,
      population: {
        ...prev.population,
        by_state: { ...prev.population.by_state, [state]: value },
      },
    }));
  }

  function removePopStateOverride(state: string) {
    setConfig(prev => {
      const byState = { ...prev.population.by_state };
      delete byState[state];
      return { ...prev, population: { ...prev.population, by_state: byState } };
    });
  }

  // ── Shift rate helpers ───────────────────────────────────────────────────
  function setShiftRate(industry: string, value: number) {
    setConfig(prev => ({
      ...prev,
      industry: {
        ...prev.industry,
        shift_rates: { ...prev.industry.shift_rates, [industry]: value },
      },
    }));
  }

  // ── Scenario selection ───────────────────────────────────────────────────
  function selectScenario(scenario: string) {
    setSelectedScenario(scenario);
    const base = deepClone(defaults);
    if (scenario === 'baseline' || !scenarios[scenario]) {
      setConfig(base);
    } else {
      setConfig(deepMerge(base, scenarios[scenario]));
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function resetAll() {
    setSelectedScenario('baseline');
    setConfig(deepClone(defaults));
  }

  // ── Run forecast ─────────────────────────────────────────────────────────
  async function handleRunForecast() {
    setRunDialogOpen(true);
    setJobStatusState('submitting');
    setJobError(null);
    setJobId(null);

    try {
      const request: ForecastRequest = {};

      if (selectedScenario !== 'baseline') {
        request.scenario = selectedScenario;
      }

      // Forecast section — always send all forecast params if any changed
      const hasOverrides = Object.keys(config.forecast.cagr_overrides).length > 0;
      const fcChanged =
        config.forecast.end_year !== defaults.forecast.end_year ||
        config.forecast.historical_range_start_year !== defaults.forecast.historical_range_start_year ||
        config.forecast.short_term_years !== defaults.forecast.short_term_years ||
        config.forecast.short_term_start_year !== defaults.forecast.short_term_start_year ||
        Math.abs(config.forecast.cagr_cap - defaults.forecast.cagr_cap) > 1e-10 ||
        hasOverrides;
      if (fcChanged) {
        request.forecast = {
          end_year: config.forecast.end_year,
          historical_range_start_year: config.forecast.historical_range_start_year,
          short_term_years: config.forecast.short_term_years,
          short_term_start_year: config.forecast.short_term_start_year,
          cagr_cap: config.forecast.cagr_cap,
          ...(hasOverrides ? { cagr_overrides: config.forecast.cagr_overrides } : {}),
        };
      }

      // Population
      const popChanged =
        config.population.fit_start_year !== defaults.population.fit_start_year ||
        config.population.national_pop_target !== defaults.population.national_pop_target ||
        config.population.growth_deceleration !== defaults.population.growth_deceleration ||
        config.population.share_damping !== defaults.population.share_damping ||
        JSON.stringify(config.population.by_state) !== JSON.stringify(defaults.population.by_state);
      if (popChanged) {
        request.population = {
          fit_start_year: config.population.fit_start_year,
          national_pop_target: config.population.national_pop_target,
          growth_deceleration: config.population.growth_deceleration,
          share_damping: config.population.share_damping,
          by_state: config.population.by_state,
        };
      }

      // Industry
      const indChanged =
        config.industry.structural_shift !== defaults.industry.structural_shift ||
        JSON.stringify(config.industry.shift_rates) !== JSON.stringify(defaults.industry.shift_rates);
      if (indChanged) {
        request.industry = {
          structural_shift: config.industry.structural_shift,
          shift_rates: config.industry.shift_rates,
        };
      }

      const result = await runForecast(request);
      setJobId(result.job_id);
      setJobStatusState('running');

      // Poll for completion
      const poll = async () => {
        try {
          const status = await getJobStatus(result.job_id);
          setJobStatusState(status.status);
          if (status.status === 'completed') {
            setTimeout(() => {
              setRunDialogOpen(false);
              router.push(`/dashboard?job_id=${result.job_id}`);
            }, 800);
          } else if (status.status === 'failed') {
            setJobError(status.error || 'Forecast failed');
          } else {
            setTimeout(poll, 2000);
          }
        } catch (err) {
          setJobError(err instanceof Error ? err.message : 'Failed to check status');
          setJobStatusState('failed');
        }
      };

      setTimeout(poll, 2000);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Failed to start forecast');
      setJobStatusState('failed');
    }
  }

  // ── Default shift rates ─────────────────────────────────────────────────
  const defaultShiftRates: Record<string, number> = React.useMemo(() => {
    return defaults.industry.shift_rates || {};
  }, [defaults]);

  const shiftIndustries = React.useMemo(() => {
    const rates = { ...defaultShiftRates, ...config.industry.shift_rates };
    return LEAF_INDUSTRIES.filter(ind => (rates[ind] ?? 0) !== 0 || ind in config.industry.shift_rates);
  }, [defaultShiftRates, config.industry.shift_rates]);

  // ── Historical range display ─────────────────────────────────────────────
  const historicalRangeLabel = config.forecast.historical_range_start_year
    ? `${config.forecast.historical_range_start_year} - 2025`
    : 'All available (2005 - 2025)';

  const forecastBadgeLabel = config.forecast.short_term_years > 0
    ? `${config.forecast.short_term_start_year}+ (${config.forecast.short_term_years}yr) → ${historicalRangeLabel}`
    : historicalRangeLabel;

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container py-8 max-w-4xl mx-auto">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          <div className="h-12 w-full bg-muted animate-pulse rounded mt-8" />
          <div className="h-64 w-full bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="container py-8 max-w-4xl mx-auto pb-28">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Configure Forecast Parameters</h1>
        </div>
        <p className="text-muted-foreground">
          GDP growth is projected by extrapolating historical CAGR (compound annual growth rate) for each state-industry pair.
          Adjust the historical data range, population assumptions, and industry shifts below.
        </p>
      </div>

      {/* ── Scenario Selector ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {SCENARIOS.map((scenario) => (
          <Button
            key={scenario}
            variant={selectedScenario === scenario ? 'default' : 'outline'}
            size="sm"
            onClick={() => selectScenario(scenario)}
          >
            {SCENARIO_LABELS[scenario]}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" size="sm" onClick={resetAll}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset to Defaults
        </Button>
      </div>

      {/* ── Accordion Sections ──────────────────────────────────────────── */}
      <Accordion defaultValue={[1, 2, 3]}>
        {/* ━━ Section 1: Forecast Horizon & Historical Range ━━━━━━━━━━━━ */}
        <AccordionItem value={1}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Forecast Horizon & Historical Range</span>
              <Badge variant="secondary">{forecastBadgeLabel}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium w-28">Start Quarter</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {config.forecast.start_quarter}
                </span>
                <span className="text-xs text-muted-foreground">(determined by data availability)</span>
              </div>
              <SliderWithInput
                label="End Year"
                description="Final year of the projection. Longer horizons compound model uncertainty."
                value={config.forecast.end_year}
                onChange={(v) => updateForecast('end_year', Math.round(v))}
                min={2030}
                max={2100}
                step={1}
              />
              <Separator />
              <SliderWithInput
                label="Long-Term CAGR Start Year"
                description="Start year for computing the long-term historical CAGR per state-industry. This rate applies after the short-term period ends (or for the entire forecast if short-term is disabled). Set to 2005 to use all available data."
                value={config.forecast.historical_range_start_year ?? 2005}
                onChange={(v) => {
                  const year = Math.round(v);
                  updateForecast('historical_range_start_year', year <= 2005 ? null : year);
                }}
                min={2005}
                max={2024}
                step={1}
              />
              <Separator />

              {/* ── Short-Term CAGR ──────────────────────────────────── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Short-Term Growth Rate</Label>
                  <Badge variant={config.forecast.short_term_years > 0 ? 'default' : 'secondary'}>
                    {config.forecast.short_term_years > 0
                      ? `${config.forecast.short_term_years}yr @ ${config.forecast.short_term_start_year}+`
                      : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a more recent historical window for the first N years of the forecast to weight current trends more heavily, then transition to the long-term rate. Set years to 0 to disable.
                </p>
                <SliderWithInput
                  label="Short-Term Duration (Years)"
                  description="Number of years to apply the short-term CAGR before switching to the long-term rate. Set to 0 to use only the long-term rate."
                  value={config.forecast.short_term_years}
                  onChange={(v) => updateForecast('short_term_years', Math.round(v))}
                  min={0}
                  max={15}
                  step={1}
                />
                {config.forecast.short_term_years > 0 && (
                  <SliderWithInput
                    label="Short-Term CAGR Start Year"
                    description="Historical range start for computing the short-term growth rate. Use a recent year (e.g. 2018-2020) to capture current momentum."
                    value={config.forecast.short_term_start_year}
                    onChange={(v) => updateForecast('short_term_start_year', Math.round(v))}
                    min={2005}
                    max={2024}
                    step={1}
                  />
                )}
                {config.forecast.short_term_years > 0 && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">Short-term: </span>
                      <span className="font-mono font-medium">{config.forecast.short_term_start_year}-2025</span>
                      <span className="text-muted-foreground"> for first </span>
                      <span className="font-mono font-medium">{config.forecast.short_term_years} years</span>
                      <span className="text-muted-foreground"> ({config.forecast.short_term_years * 4} quarters)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Long-term: </span>
                      <span className="font-mono font-medium">{config.forecast.historical_range_start_year ?? 2005}-2025</span>
                      <span className="text-muted-foreground"> for remaining </span>
                      <span className="font-mono font-medium">{config.forecast.end_year - 2025 - config.forecast.short_term_years} years</span>
                    </div>
                  </div>
                )}
              </div>
              <Separator />

              {/* ── CAGR Preview Table ───────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Growth Rate Preview</Label>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Historical CAGR for each state-industry pair, sorted by magnitude. Review for outliers before running the forecast. Optionally set a cap below to limit extreme values.
                      </TooltipContent>
                    </Tooltip>
                    {cagrLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {cagrPreview.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {cagrPreview.length} pairs | Range: {historicalRangeLabel}
                    </span>
                  )}
                </div>

                {cagrPreview.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                          <tr className="text-xs text-muted-foreground">
                            <th className="text-left px-2 py-2 font-medium w-8">#</th>
                            <th className="text-left px-2 py-2 font-medium">State</th>
                            <th className="text-left px-2 py-2 font-medium">Industry</th>
                            <th className="text-right px-2 py-2 font-medium">CAGR</th>
                            <th className="text-right px-2 py-2 font-medium">Base GDP</th>
                            <th className="text-center px-2 py-2 font-medium">Cap %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cagrShowAll ? cagrPreview : cagrPreview.slice(0, 30)).map((row, i) => {
                            const pairKey = `${row.state}|${row.industry}`;
                            const pairCap = config.forecast.cagr_overrides[pairKey];
                            const hasPairCap = pairCap !== undefined;
                            const effectiveCagr = hasPairCap
                              ? Math.max(-pairCap, Math.min(pairCap, row.annual_cagr))
                              : config.forecast.cagr_cap > 0
                                ? Math.max(-config.forecast.cagr_cap, Math.min(config.forecast.cagr_cap, row.annual_cagr))
                                : row.annual_cagr;
                            const multiplier = Math.pow(1 + effectiveCagr, 25);
                            const isHigh = Math.abs(row.annual_cagr) > 0.05;
                            return (
                              <tr
                                key={pairKey}
                                className={cn(
                                  'border-t transition-colors',
                                  hasPairCap && 'bg-yellow-50 dark:bg-yellow-950/20',
                                  isHigh && !hasPairCap && 'bg-red-50/50 dark:bg-red-950/10'
                                )}
                              >
                                <td className="px-2 py-1 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                                <td className="px-2 py-1 truncate max-w-[100px]" title={row.state}>
                                  {row.state}
                                </td>
                                <td className="px-2 py-1 truncate max-w-[150px]" title={row.industry}>
                                  {INDUSTRY_SHORT_NAMES[row.industry] || row.industry}
                                </td>
                                <td className={cn(
                                  'px-2 py-1 text-right font-mono tabular-nums whitespace-nowrap',
                                  row.annual_cagr > 0.05 && 'text-red-600 dark:text-red-400 font-semibold',
                                  row.annual_cagr < -0.03 && 'text-blue-600 dark:text-blue-400 font-semibold',
                                )}>
                                  {(row.annual_cagr * 100).toFixed(2)}%
                                  {hasPairCap && (
                                    <span className="ml-1 text-yellow-600 dark:text-yellow-400" title={`Capped → ${(effectiveCagr * 100).toFixed(2)}% (${multiplier.toFixed(1)}x in 25yr)`}>
                                      {'\u2192'}{(effectiveCagr * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-right font-mono tabular-nums text-muted-foreground">
                                  {formatGDP(row.base_gdp)}
                                </td>
                                <td className="px-2 py-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <Input
                                      type="number"
                                      placeholder="-"
                                      value={hasPairCap ? parseFloat((pairCap * 100).toFixed(1)) : ''}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (!isNaN(v) && v > 0) {
                                          setCagrOverride(row.state, row.industry, v / 100);
                                        } else if (e.target.value === '' || e.target.value === '0') {
                                          removeCagrOverride(row.state, row.industry);
                                        }
                                      }}
                                      step={0.5}
                                      className="h-6 w-16 text-xs text-center tabular-nums px-1"
                                    />
                                    {hasPairCap && (
                                      <button
                                        type="button"
                                        onClick={() => removeCagrOverride(row.state, row.industry)}
                                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                        title="Remove cap"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t px-3 py-2 bg-muted/30">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {Object.keys(config.forecast.cagr_overrides).length > 0 && (
                          <span>
                            <span className="inline-block w-2 h-2 rounded-sm bg-yellow-200 dark:bg-yellow-800 mr-1" />
                            {Object.keys(config.forecast.cagr_overrides).length} pair{Object.keys(config.forecast.cagr_overrides).length !== 1 ? 's' : ''} capped
                          </span>
                        )}
                        <span>
                          <span className="inline-block w-2 h-2 rounded-sm bg-red-100 dark:bg-red-900/30 mr-1" />
                          &gt;5% highlighted
                        </span>
                        <span className="text-muted-foreground/60">Type a % in Cap to limit that pair</span>
                      </div>
                      {cagrPreview.length > 30 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCagrShowAll(!cagrShowAll)}
                        >
                          {cagrShowAll ? 'Show Top 30' : `Show All ${cagrPreview.length}`}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── CAGR Cap Slider ──────────────────────────────────── */}
              <SliderWithInput
                label="CAGR Cap (Optional)"
                description="Set a maximum annual growth rate to cap extreme outliers identified above. Set to 0 to apply no cap."
                value={config.forecast.cagr_cap}
                onChange={(v) => updateForecast('cagr_cap', v)}
                min={0}
                max={0.15}
                step={0.005}
                displayAsPercent
              />
              {config.forecast.cagr_cap > 0 && (
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-sm">
                  <span className="font-medium">Cap active: </span>
                  All state-industry growth rates will be clamped to {'\u00B1'}{(config.forecast.cagr_cap * 100).toFixed(1)}%.
                  {' '}This affects {cagrPreview.filter(r => Math.abs(r.annual_cagr) > config.forecast.cagr_cap).length} of {cagrPreview.length} pairs.
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 2: Population ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={2}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Population</span>
              <Badge variant="secondary">target {(config.population.national_pop_target / 1_000_000).toFixed(0)}M</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <SliderWithInput
                label="National Population Target (2050)"
                description="Target US population for 2050. Default 370M is based on Census Bureau (~369M) and Cooper Center (~371M) consensus. CBO projects ~360M under lower immigration."
                value={config.population.national_pop_target / 1_000_000}
                onChange={(v) => updatePopulation('national_pop_target', Math.round(v * 1_000_000))}
                min={340}
                max={400}
                step={1}
              />

              <SliderWithInput
                label="Population Fit Start Year"
                description="Compute recent population growth rates (CAGR) from this year. More recent = captures current migration trends; earlier = smooths volatility."
                value={config.population.fit_start_year}
                onChange={(v) => updatePopulation('fit_start_year', Math.round(v))}
                min={2000}
                max={2020}
                step={1}
              />

              <SliderWithInput
                label="Growth Deceleration"
                description="How quickly population growth slows over the forecast. Higher = front-loaded growth, lower = more linear path to target."
                value={config.population.growth_deceleration}
                onChange={(v) => updatePopulation('growth_deceleration', v)}
                min={0.01}
                max={0.08}
                step={0.005}
                displayAsPercent
              />

              <SliderWithInput
                label="State Share Damping"
                description="How quickly fast/slow-growing states converge toward the national average. Higher = faster convergence."
                value={config.population.share_damping}
                onChange={(v) => updatePopulation('share_damping', v)}
                min={0.01}
                max={0.06}
                step={0.005}
                displayAsPercent
              />

              {/* State Population Overrides */}
              <CollapsibleSection title="State-Specific Growth Rate Overrides">
                <div className="space-y-2">
                  {Object.entries(config.population.by_state).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(config.population.by_state).map(([state, rate]) => (
                        <div key={state} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center px-1 py-1">
                          <span className="text-sm">{state}</span>
                          <PercentInput
                            value={rate as number}
                            onChange={(v) => setPopStateOverride(state, v)}
                            step={0.1}
                            decimals={1}
                          />
                          <button
                            type="button"
                            onClick={() => removePopStateOverride(state)}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove override"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={newPopState}
                      onChange={(e) => setNewPopState(e.target.value)}
                      className="h-7 rounded-lg border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Select state...</option>
                      {US_STATES.filter(s => !(s in config.population.by_state)).map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={!newPopState}
                      onClick={() => {
                        if (newPopState) {
                          setPopStateOverride(newPopState, 0.005);
                          setNewPopState('');
                        }
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {Object.keys(config.population.by_state).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No state-specific overrides. Add one to force a specific growth rate for a state.
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 3: Industry Structural Shifts ━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={3}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Industry Structural Shifts</span>
              <Badge variant={config.industry.structural_shift ? 'default' : 'secondary'}>
                {config.industry.structural_shift ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Enable Structural Shifts</Label>
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3.5 w-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    When enabled, industry shares of GDP shift over time. Tech and services grow as shares; manufacturing and agriculture shrink.
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant={config.industry.structural_shift ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => updateIndustry('structural_shift', !config.industry.structural_shift)}
                >
                  {config.industry.structural_shift ? 'On' : 'Off'}
                </Button>
              </div>

              {config.industry.structural_shift && (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_110px] gap-2 items-center text-xs font-medium text-muted-foreground pb-1">
                    <span>Industry</span>
                    <span className="text-center">Shift (%/yr)</span>
                  </div>
                  {shiftIndustries.map((industry) => {
                    const rate = config.industry.shift_rates[industry] ?? defaultShiftRates[industry] ?? 0;
                    return (
                      <div
                        key={industry}
                        className="grid grid-cols-[1fr_110px] gap-2 items-center py-1 px-1"
                      >
                        <span className="text-sm truncate" title={industry}>
                          {INDUSTRY_SHORT_NAMES[industry] || industry}
                        </span>
                        <PercentInput
                          value={rate}
                          onChange={(v) => setShiftRate(industry, v)}
                          step={0.01}
                          decimals={2}
                          className={cn(
                            rate > 0 && 'text-green-600 dark:text-green-400',
                            rate < 0 && 'text-red-600 dark:text-red-400'
                          )}
                        />
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground pt-2">
                    Positive = growing share of GDP. Negative = shrinking share. Industries not listed maintain their current share.
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ── Sticky Bottom Bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            {modifiedCount > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {modifiedCount} parameter{modifiedCount !== 1 ? 's' : ''} modified
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Using defaults</span>
            )}
            {selectedScenario !== 'baseline' && (
              <Badge variant="outline">
                {SCENARIO_LABELS[selectedScenario]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              disabled={modifiedCount === 0 && selectedScenario === 'baseline'}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset All
            </Button>
            <Button size="sm" onClick={handleRunForecast}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Run Forecast
            </Button>
          </div>
        </div>
      </div>

      {/* ── Run Forecast Dialog ─────────────────────────────────────────── */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={jobStatus === 'failed'}>
          <DialogHeader>
            <DialogTitle>
              {jobStatus === 'submitting' && 'Starting Forecast...'}
              {jobStatus === 'queued' && 'Forecast Queued'}
              {jobStatus === 'running' && 'Running Forecast...'}
              {jobStatus === 'completed' && 'Forecast Complete!'}
              {jobStatus === 'failed' && 'Forecast Failed'}
            </DialogTitle>
            <DialogDescription>
              {(jobStatus === 'submitting' || jobStatus === 'queued' || jobStatus === 'running') &&
                'Running the forecast model. This typically takes about 15 seconds.'}
              {jobStatus === 'completed' && 'Redirecting to dashboard...'}
              {jobStatus === 'failed' && (jobError || 'An error occurred while running the forecast.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {(jobStatus === 'submitting' || jobStatus === 'queued' || jobStatus === 'running') && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{
                        width:
                          jobStatus === 'submitting'
                            ? '10%'
                            : jobStatus === 'queued'
                              ? '25%'
                              : '60%',
                      }}
                    />
                  </div>
                </div>
                {jobId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Job: {jobId.slice(0, 8)}...
                  </p>
                )}
              </div>
            )}
            {jobStatus === 'completed' && (
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            )}
            {jobStatus === 'failed' && (
              <div className="flex flex-col items-center gap-3">
                <XCircle className="h-10 w-10 text-destructive" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRunDialogOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
