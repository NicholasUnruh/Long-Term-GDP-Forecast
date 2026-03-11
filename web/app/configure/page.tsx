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
import { formatPercent } from '@/lib/formatters';
import { getDefaults, getScenarios, runForecast, getJobStatus } from '@/lib/api-client';
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
    },
    production_function: {
      alpha: 0.30,
      depreciation_rate: 0.05,
    },
    tfp: {
      national_growth_rate: 0.012,
      by_industry: {},
      by_state: {},
      convergence_rate: 0.02,
    },
    capital: {
      investment_to_gdp_ratio: 0.21,
      capital_output_ratio: 3.0,
      capex_growth_adjustment: 0.002,
      by_industry: {},
    },
    labor: {
      lfpr_trend: -0.0014,
      working_age_share_trend: -0.002,
      natural_unemployment_rate: 0.04,
      hours_growth: -0.001,
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
      // Compare scalar values
      if (typeof current === 'number' && typeof defaults === 'number') {
        if (Math.abs(current - defaults) > 1e-10) count++;
      } else if (current !== defaults) {
        count++;
      }
    }
    return count;
  }
  // Both are objects
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

// ─── Computed Value Display ──────────────────────────────────────────────────
function ComputedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
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
  value: number;       // raw decimal (e.g. 0.022 = 2.2%)
  onChange: (rawValue: number) => void;
  step?: number;       // in percent units (e.g. 0.1 = 0.1%)
  decimals?: number;   // decimal places for % display
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
  const [newTfpState, setNewTfpState] = React.useState('');
  const [newPopState, setNewPopState] = React.useState('');


  // ── Fetch defaults & scenarios on mount ──────────────────────────────────
  React.useEffect(() => {
    async function load() {
      try {
        const [defaultsData, scenariosResp] = await Promise.all([
          getDefaults(),
          getScenarios(),
        ]);

        // Merge API defaults with our fallback structure
        const mergedDefaults = deepMerge(getDefaultConfig(), defaultsData) as ForecastConfig;
        setDefaults(mergedDefaults);
        setConfig(deepClone(mergedDefaults));
        setScenariosData(scenariosResp);
      } catch {
        // If API is not available, use fallback defaults
        console.warn('Could not fetch defaults from API, using fallback defaults');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────
  const impliedCapitalGrowth = React.useMemo(() => {
    const { investment_to_gdp_ratio, capital_output_ratio, capex_growth_adjustment } = config.capital;
    const { depreciation_rate } = config.production_function;
    return (investment_to_gdp_ratio / capital_output_ratio) - depreciation_rate + capex_growth_adjustment;
  }, [config.capital, config.production_function]);

  const impliedLaborGrowth = React.useMemo(() => {
    const { lfpr_trend, working_age_share_trend, hours_growth } = config.labor;
    return lfpr_trend + working_age_share_trend + hours_growth;
  }, [config.labor]);

  const modifiedCount = React.useMemo(
    () => countModified(config, defaults),
    [config, defaults]
  );

  // ── Updater helpers ──────────────────────────────────────────────────────
  function updateForecast(field: keyof ForecastConfig['forecast'], value: any) {
    setConfig(prev => ({
      ...prev,
      forecast: { ...prev.forecast, [field]: value },
    }));
  }

  function updateProdFn(field: keyof ForecastConfig['production_function'], value: number) {
    setConfig(prev => ({
      ...prev,
      production_function: { ...prev.production_function, [field]: value },
    }));
  }

  function updateTfp(field: keyof ForecastConfig['tfp'], value: any) {
    setConfig(prev => ({
      ...prev,
      tfp: { ...prev.tfp, [field]: value },
    }));
  }

  function updateCapital(field: keyof ForecastConfig['capital'], value: any) {
    setConfig(prev => ({
      ...prev,
      capital: { ...prev.capital, [field]: value },
    }));
  }

  function updateLabor(field: keyof ForecastConfig['labor'], value: number) {
    setConfig(prev => ({
      ...prev,
      labor: { ...prev.labor, [field]: value },
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

  // ── TFP industry override helpers ────────────────────────────────────────
  function setTfpIndustryOverride(industry: string, value: number) {
    setConfig(prev => ({
      ...prev,
      tfp: {
        ...prev.tfp,
        by_industry: { ...prev.tfp.by_industry, [industry]: value },
      },
    }));
  }

  function removeTfpIndustryOverride(industry: string) {
    setConfig(prev => {
      const byIndustry = { ...prev.tfp.by_industry };
      delete byIndustry[industry];
      return { ...prev, tfp: { ...prev.tfp, by_industry: byIndustry } };
    });
  }

  // ── TFP state override helpers ───────────────────────────────────────────
  function setTfpStateOverride(state: string, value: number) {
    setConfig(prev => ({
      ...prev,
      tfp: {
        ...prev.tfp,
        by_state: { ...prev.tfp.by_state, [state]: value },
      },
    }));
  }

  function removeTfpStateOverride(state: string) {
    setConfig(prev => {
      const byState = { ...prev.tfp.by_state };
      delete byState[state];
      return { ...prev, tfp: { ...prev.tfp, by_state: byState } };
    });
  }

  // ── Capital industry override helpers ────────────────────────────────────
  function setCapitalIndustryOverride(
    industry: string,
    field: 'investment_ratio' | 'alpha',
    value: number
  ) {
    setConfig(prev => {
      const existing = prev.capital.by_industry[industry] || {
        investment_ratio: config.capital.investment_to_gdp_ratio,
        alpha: config.production_function.alpha,
      };
      return {
        ...prev,
        capital: {
          ...prev.capital,
          by_industry: {
            ...prev.capital.by_industry,
            [industry]: { ...existing, [field]: value },
          },
        },
      };
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
      // Build the request: only include overrides from defaults
      const request: ForecastRequest = {};

      if (selectedScenario !== 'baseline') {
        request.scenario = selectedScenario;
      }

      // Always send the full config as overrides so the API gets exact values
      if (config.forecast.end_year !== defaults.forecast.end_year) {
        request.forecast = { end_year: config.forecast.end_year };
      }

      const pf = config.production_function;
      const pfD = defaults.production_function;
      if (pf.alpha !== pfD.alpha || pf.depreciation_rate !== pfD.depreciation_rate) {
        request.production_function = {};
        if (pf.alpha !== pfD.alpha) request.production_function.alpha = pf.alpha;
        if (pf.depreciation_rate !== pfD.depreciation_rate) request.production_function.depreciation_rate = pf.depreciation_rate;
      }

      // TFP
      const tfpChanged =
        config.tfp.national_growth_rate !== defaults.tfp.national_growth_rate ||
        config.tfp.convergence_rate !== defaults.tfp.convergence_rate ||
        JSON.stringify(config.tfp.by_industry) !== JSON.stringify(defaults.tfp.by_industry) ||
        JSON.stringify(config.tfp.by_state) !== JSON.stringify(defaults.tfp.by_state);
      if (tfpChanged) {
        request.tfp = {
          national_growth_rate: config.tfp.national_growth_rate,
          convergence_rate: config.tfp.convergence_rate,
          by_industry: config.tfp.by_industry,
          by_state: config.tfp.by_state,
        };
      }

      // Capital
      const capChanged =
        config.capital.investment_to_gdp_ratio !== defaults.capital.investment_to_gdp_ratio ||
        config.capital.capital_output_ratio !== defaults.capital.capital_output_ratio ||
        config.capital.capex_growth_adjustment !== defaults.capital.capex_growth_adjustment ||
        JSON.stringify(config.capital.by_industry) !== JSON.stringify(defaults.capital.by_industry);
      if (capChanged) {
        request.capital = {
          investment_to_gdp_ratio: config.capital.investment_to_gdp_ratio,
          capital_output_ratio: config.capital.capital_output_ratio,
          capex_growth_adjustment: config.capital.capex_growth_adjustment,
          by_industry: config.capital.by_industry,
        };
      }

      // Labor
      const labChanged =
        config.labor.lfpr_trend !== defaults.labor.lfpr_trend ||
        config.labor.working_age_share_trend !== defaults.labor.working_age_share_trend ||
        config.labor.natural_unemployment_rate !== defaults.labor.natural_unemployment_rate ||
        config.labor.hours_growth !== defaults.labor.hours_growth;
      if (labChanged) {
        request.labor = { ...config.labor };
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
            // Brief delay so user sees the "completed" state
            setTimeout(() => {
              setRunDialogOpen(false);
              router.push(`/dashboard?job_id=${result.job_id}`);
            }, 800);
          } else if (status.status === 'failed') {
            setJobError(status.error || 'Forecast failed');
          } else {
            // Still running, poll again
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

  // ── Default industry TFP rates from config YAML ─────────────────────────
  const defaultIndustryTfp: Record<string, number> = React.useMemo(() => {
    // Merge defaults.tfp.by_industry with config.tfp.by_industry
    const map: Record<string, number> = {};
    for (const ind of LEAF_INDUSTRIES) {
      map[ind] = defaults.tfp.by_industry[ind] ?? defaults.tfp.national_growth_rate;
    }
    return map;
  }, [defaults]);

  // ── Default shift rates ─────────────────────────────────────────────────
  const defaultShiftRates: Record<string, number> = React.useMemo(() => {
    return defaults.industry.shift_rates || {};
  }, [defaults]);

  // Industries with nonzero default shift rates
  const shiftIndustries = React.useMemo(() => {
    const rates = { ...defaultShiftRates, ...config.industry.shift_rates };
    return LEAF_INDUSTRIES.filter(ind => (rates[ind] ?? 0) !== 0 || ind in config.industry.shift_rates);
  }, [defaultShiftRates, config.industry.shift_rates]);

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
          Adjust the Cobb-Douglas production function parameters to customize your GDP forecast.
          Select a scenario preset or fine-tune individual parameters.
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
        {/* ━━ Section 1: Forecast Horizon ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={1}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Forecast Horizon</span>
              <Badge variant="secondary">{config.forecast.start_quarter} - {config.forecast.end_year}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-4 pt-2">
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
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 2: Production Function ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={2}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Production Function</span>
              <Badge variant="secondary">alpha = {(config.production_function.alpha * 100).toFixed(0)}%</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <SliderWithInput
                label="Alpha (Capital Share)"
                description="Capital's share of output in the Cobb-Douglas function. CBO uses 30%. Higher values make investment more important; lower values make labor more important."
                value={config.production_function.alpha}
                onChange={(v) => updateProdFn('alpha', v)}
                min={0.10}
                max={0.60}
                step={0.01}
                displayAsPercent
              />
              <SliderWithInput
                label="Depreciation Rate"
                description="Annual rate at which capital wears out. Higher depreciation means more investment is needed just to maintain the capital stock."
                value={config.production_function.depreciation_rate}
                onChange={(v) => updateProdFn('depreciation_rate', v)}
                min={0.01}
                max={0.15}
                step={0.005}
                displayAsPercent
              />
              <ComputedValue
                label="Implied Capital Growth: (I/Y) / (K/Y) - delta + adj ="
                value={formatPercent(impliedCapitalGrowth) + '/yr'}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 3: TFP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={3}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>TFP (Total Factor Productivity)</span>
              <Badge variant="secondary">{formatPercent(config.tfp.national_growth_rate)}/yr</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <SliderWithInput
                label="National Growth Rate"
                description="TFP captures technological progress, innovation, and efficiency gains. This is the single most important driver of long-term GDP growth. US long-run average: 1.0-1.5%."
                value={config.tfp.national_growth_rate}
                onChange={(v) => updateTfp('national_growth_rate', v)}
                min={-0.01}
                max={0.05}
                step={0.001}
                displayAsPercent
              />
              <SliderWithInput
                label="Convergence Rate"
                description="Speed at which lagging states converge toward the national TFP level. 0 = no convergence, 5% = fast convergence."
                value={config.tfp.convergence_rate}
                onChange={(v) => updateTfp('convergence_rate', v)}
                min={0}
                max={0.10}
                step={0.005}
                displayAsPercent
              />

              {/* Industry TFP Overrides */}
              <CollapsibleSection title="Industry-Specific TFP Overrides">
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_100px_36px] gap-2 items-center text-xs font-medium text-muted-foreground pb-1">
                    <span>Industry</span>
                    <span className="text-center">TFP (%)</span>
                    <span />
                  </div>
                  {LEAF_INDUSTRIES.map((industry) => {
                    const hasOverride = industry in config.tfp.by_industry;
                    const currentValue = config.tfp.by_industry[industry] ?? defaultIndustryTfp[industry];
                    const isModified = hasOverride && config.tfp.by_industry[industry] !== defaultIndustryTfp[industry];
                    return (
                      <div
                        key={industry}
                        className={cn(
                          'grid grid-cols-[1fr_100px_36px] gap-2 items-center py-1 rounded px-1',
                          isModified && 'bg-primary/5'
                        )}
                      >
                        <span className="text-sm truncate" title={industry}>
                          {INDUSTRY_SHORT_NAMES[industry] || industry}
                        </span>
                        <PercentInput
                          value={currentValue}
                          onChange={(v) => setTfpIndustryOverride(industry, v)}
                          step={0.1}
                          decimals={1}
                        />
                        {hasOverride ? (
                          <button
                            type="button"
                            onClick={() => removeTfpIndustryOverride(industry)}
                            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remove override"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <div className="h-7 w-7" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>

              {/* State TFP Overrides */}
              <CollapsibleSection title="State-Specific TFP Overrides">
                <div className="space-y-2">
                  {Object.entries(config.tfp.by_state).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(config.tfp.by_state).map(([state, rate]) => (
                        <div key={state} className="grid grid-cols-[1fr_100px_36px] gap-2 items-center px-1 py-1">
                          <span className="text-sm">{state}</span>
                          <PercentInput
                            value={rate as number}
                            onChange={(v) => setTfpStateOverride(state, v)}
                            step={0.1}
                            decimals={1}
                          />
                          <button
                            type="button"
                            onClick={() => removeTfpStateOverride(state)}
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
                      value={newTfpState}
                      onChange={(e) => setNewTfpState(e.target.value)}
                      className="h-7 rounded-lg border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Select state...</option>
                      {US_STATES.filter(s => !(s in config.tfp.by_state)).map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={!newTfpState}
                      onClick={() => {
                        if (newTfpState) {
                          setTfpStateOverride(newTfpState, config.tfp.national_growth_rate);
                          setNewTfpState('');
                        }
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {Object.keys(config.tfp.by_state).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No state-specific TFP overrides. Add one to set a different TFP rate for a specific state.
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 4: Capital & Investment ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={4}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Capital & Investment</span>
              <Badge variant="secondary">I/Y = {formatPercent(config.capital.investment_to_gdp_ratio)}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <SliderWithInput
                label="Investment/GDP Ratio"
                description="Share of GDP that goes to investment. Higher values mean more capital accumulation and faster growth."
                value={config.capital.investment_to_gdp_ratio}
                onChange={(v) => updateCapital('investment_to_gdp_ratio', v)}
                min={0.10}
                max={0.40}
                step={0.01}
                displayAsPercent
              />
              <SliderWithInput
                label="Capital/Output Ratio"
                description="K/Y ratio: how much capital is needed per unit of GDP. Higher values mean more capital-intensive economy."
                value={config.capital.capital_output_ratio}
                onChange={(v) => updateCapital('capital_output_ratio', v)}
                min={1.5}
                max={6.0}
                step={0.1}
              />
              <SliderWithInput
                label="CapEx Growth Adjustment"
                description="Extra annual boost or drag on investment growth. Positive = investment boom, negative = investment slump."
                value={config.capital.capex_growth_adjustment}
                onChange={(v) => updateCapital('capex_growth_adjustment', v)}
                min={-0.03}
                max={0.03}
                step={0.001}
                displayAsPercent
              />
              <ComputedValue
                label="Implied Capital Growth: (I/Y) / (K/Y) - delta + adj ="
                value={formatPercent(impliedCapitalGrowth) + '/yr'}
              />

              {/* Industry Capital Overrides */}
              <CollapsibleSection title="Industry-Specific Capital Overrides">
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center text-xs font-medium text-muted-foreground pb-1">
                    <span>Industry</span>
                    <span className="text-center">Invest (%)</span>
                    <span className="text-center">Alpha (%)</span>
                  </div>
                  {LEAF_INDUSTRIES.map((industry) => {
                    const override = config.capital.by_industry[industry];
                    const defaultOverride = defaults.capital.by_industry[industry];
                    const investRatio = override?.investment_ratio ?? defaultOverride?.investment_ratio ?? config.capital.investment_to_gdp_ratio;
                    const alpha = override?.alpha ?? defaultOverride?.alpha ?? config.production_function.alpha;
                    return (
                      <div
                        key={industry}
                        className="grid grid-cols-[1fr_90px_90px] gap-2 items-center py-1 px-1"
                      >
                        <span className="text-sm truncate" title={industry}>
                          {INDUSTRY_SHORT_NAMES[industry] || industry}
                        </span>
                        <PercentInput
                          value={investRatio}
                          onChange={(v) => setCapitalIndustryOverride(industry, 'investment_ratio', v)}
                          step={1}
                          decimals={0}
                        />
                        <PercentInput
                          value={alpha}
                          onChange={(v) => setCapitalIndustryOverride(industry, 'alpha', v)}
                          step={1}
                          decimals={0}
                        />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 5: Labor Force ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={5}>
          <AccordionTrigger className="text-base px-1">
            <div className="flex items-center gap-2">
              <span>Labor Force</span>
              <Badge variant="secondary">LFPR {formatPercent(config.labor.lfpr_trend)}/yr</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-1">
            <div className="space-y-5 pt-2">
              <SliderWithInput
                label="LFPR Trend"
                description="Annual change in labor force participation rate. Negative means fewer people choosing to work. US LFPR peaked at ~67% in 2000, declined to ~62% by 2020."
                value={config.labor.lfpr_trend}
                onChange={(v) => updateLabor('lfpr_trend', v)}
                min={-0.005}
                max={0.003}
                step={0.0005}
                displayAsPercent
              />
              <SliderWithInput
                label="Working-Age Share Trend"
                description="Annual change in the 15-64 age group as share of population. Negative means the population is aging."
                value={config.labor.working_age_share_trend}
                onChange={(v) => updateLabor('working_age_share_trend', v)}
                min={-0.005}
                max={0.001}
                step={0.0005}
                displayAsPercent
              />
              <SliderWithInput
                label="Natural Unemployment Rate"
                description="Long-run equilibrium unemployment rate. Does not directly affect GDP growth rate but is used for structural labor calculations."
                value={config.labor.natural_unemployment_rate}
                onChange={(v) => updateLabor('natural_unemployment_rate', v)}
                min={0.02}
                max={0.08}
                step={0.005}
                displayAsPercent
              />
              <SliderWithInput
                label="Hours Growth"
                description="Annual change in average hours worked per worker. Negative = trend toward shorter workweeks."
                value={config.labor.hours_growth}
                onChange={(v) => updateLabor('hours_growth', v)}
                min={-0.003}
                max={0.003}
                step={0.0005}
                displayAsPercent
              />
              <ComputedValue
                label="Implied Labor Growth (excl. population):"
                value={formatPercent(impliedLaborGrowth) + '/yr'}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ━━ Section 6: Population ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={6}>
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
                label="Fit Start Year"
                description="Compute recent growth rates (CAGR) from this year. More recent = captures current migration trends; earlier = smooths volatility."
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

        {/* ━━ Section 7: Industry Structural Shifts ━━━━━━━━━━━━━━━━━━━━ */}
        <AccordionItem value={7}>
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
