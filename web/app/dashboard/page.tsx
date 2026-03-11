'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { SummaryMetricsCards } from '@/components/dashboard/summary-metrics';
import { StackedGDPPerCapitaChart } from '@/components/dashboard/stacked-gdp-per-capita-chart';
import { GDPTrendsChart } from '@/components/dashboard/gdp-trends-chart';
import { CAGRByStateTable } from '@/components/dashboard/cagr-by-state-table';
import { CAGRByIndustryChart } from '@/components/dashboard/cagr-by-industry-chart';
import { DataExplorer } from '@/components/dashboard/data-explorer';
import { IndustryMultiSelect } from '@/components/dashboard/industry-multi-select';
import { ChartErrorBoundary } from '@/components/charts/chart-error-boundary';
import {
  useJobStatus,
  useSummary,
  useCAGRByState,
  useCAGRByIndustry,
  useStackedGDPPerCapita,
  useGDPTrends,
} from '@/lib/hooks/use-forecast';
import { SCENARIO_LABELS } from '@/lib/constants';
import { Settings2, Download, BarChart3, Loader2 } from 'lucide-react';

const STATES_LIST = [
  'United States',
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job_id') || 'baseline';
  const scenarioParam = searchParams.get('scenario') || 'baseline';
  const scenarioLabel = SCENARIO_LABELS[scenarioParam] || scenarioParam;

  const [selectedState, setSelectedState] = useState('United States');
  const [activeTab, setActiveTab] = useState('percapita');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['All industry total']);

  // ── Job status (polls until complete) ─────────────────────────────────────
  const jobStatus = useJobStatus(jobId);
  const isReady = jobStatus.data?.status === 'completed';

  // ── Data hooks (only fire when job is ready) ──────────────────────────────
  const activeJobId = isReady ? jobId : null;
  const { data: summary, isLoading: summaryLoading } = useSummary(activeJobId, selectedState);
  const { data: cagrByState, isLoading: cagrStateLoading } = useCAGRByState(activeJobId);
  const { data: cagrByIndustry, isLoading: cagrIndustryLoading } = useCAGRByIndustry(activeJobId, selectedState);
  const { data: stackedData, isLoading: stackedLoading, isError: stackedError } = useStackedGDPPerCapita(activeJobId, selectedState);
  const { data: trendsData, isLoading: trendsLoading, isError: trendsError } = useGDPTrends(
    activeJobId,
    selectedState,
    selectedIndustries,
  );

  // Build states list from CAGR data if available, otherwise use fallback
  const statesList = cagrByState
    ? ['United States', ...cagrByState.map((r) => r.state)]
    : STATES_LIST;

  const handleStateSelect = (state: string | null) => {
    if (!state) return;
    setSelectedState(state);
  };

  const handleExport = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    window.open(`${apiBase}/forecast/results/${jobId}/export`, '_blank');
  };

  // ── Loading state: show spinner while baseline computes ───────────────────
  if (!isReady) {
    const status = jobStatus.data?.status;
    const isFailed = status === 'failed';

    return (
      <div className="container py-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          {isFailed ? (
            <>
              <div className="rounded-full bg-destructive/10 p-4">
                <BarChart3 className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold">Forecast Failed</h2>
              <p className="text-sm text-muted-foreground max-w-md text-center">
                {jobStatus.data?.error || 'An error occurred while computing the forecast.'}
              </p>
              <Link href="/configure">
                <Button>Try Again</Button>
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <h2 className="text-xl font-semibold">Computing Forecast</h2>
              <p className="text-sm text-muted-foreground">
                {status === 'running'
                  ? 'Running the model... This typically takes about 14 seconds.'
                  : 'Waiting to start...'}
              </p>
              {jobStatus.data?.progress != null && jobStatus.data.progress > 0 && (
                <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${jobStatus.data.progress}%` }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Results Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{scenarioLabel}</Badge>
              <span className="text-sm text-muted-foreground">Job: {jobId}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/configure">
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1.5 h-4 w-4" />
              Configure Parameters
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Summary Metrics ────────────────────────────────────────────────── */}
      <SummaryMetricsCards summary={summary} isLoading={summaryLoading} state={selectedState} />

      {/* ── State Selector (shared across tabs) ────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">State:</span>
        <Select value={selectedState} onValueChange={handleStateSelect}>
          <SelectTrigger className="w-[220px]">
            <span data-slot="select-value" className="flex flex-1 text-left line-clamp-1">
              {selectedState}
            </span>
          </SelectTrigger>
          <SelectContent>
            {statesList.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="percapita">Per Capita</TabsTrigger>
          <TabsTrigger value="trends">GDP Trends</TabsTrigger>
          <TabsTrigger value="cagr">Industry & CAGR</TabsTrigger>
          <TabsTrigger value="explorer">Data Explorer</TabsTrigger>
        </TabsList>

        {/* ── Per Capita Tab (default) ───────────────────────────────────── */}
        <TabsContent value="percapita">
          <ChartErrorBoundary>
            <StackedGDPPerCapitaChart
              data={stackedData}
              isLoading={stackedLoading}
              state={selectedState}
            />
          </ChartErrorBoundary>
        </TabsContent>

        {/* ── GDP Trends Tab ─────────────────────────────────────────────── */}
        <TabsContent value="trends">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Industries:</span>
              <IndustryMultiSelect
                selected={selectedIndustries}
                onChange={setSelectedIndustries}
              />
            </div>
            <ChartErrorBoundary>
              <GDPTrendsChart
                data={trendsData}
                isLoading={trendsLoading}
                isError={trendsError}
                state={selectedState}
                selectedIndustries={selectedIndustries}
              />
            </ChartErrorBoundary>
          </div>
        </TabsContent>

        {/* ── Industry & CAGR Tab ────────────────────────────────────────── */}
        <TabsContent value="cagr">
          <div className="space-y-6">
            <Tabs defaultValue="by-state">
              <TabsList variant="line">
                <TabsTrigger value="by-state">CAGR by State</TabsTrigger>
                <TabsTrigger value="by-industry">CAGR by Industry</TabsTrigger>
              </TabsList>

              <TabsContent value="by-state" className="mt-4">
                <CAGRByStateTable
                  data={cagrByState}
                  isLoading={cagrStateLoading}
                  onStateSelect={handleStateSelect}
                />
              </TabsContent>

              <TabsContent value="by-industry" className="mt-4">
                <ChartErrorBoundary>
                  <CAGRByIndustryChart
                    data={cagrByIndustry}
                    isLoading={cagrIndustryLoading}
                    state={selectedState}
                  />
                </ChartErrorBoundary>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* ── Data Explorer Tab ──────────────────────────────────────────── */}
        <TabsContent value="explorer">
          <DataExplorer jobId={jobId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="container py-6 space-y-6 max-w-6xl mx-auto">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
