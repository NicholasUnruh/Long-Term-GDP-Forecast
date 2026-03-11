'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGDPTable, useGDPPerCapitaTable } from '@/lib/hooks/use-forecast';
import { formatGDP, formatPopulation, formatPerCapita } from '@/lib/formatters';
import { LEAF_INDUSTRIES, INDUSTRY_SHORT_NAMES } from '@/lib/constants';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  jobId: string;
}

type Dataset = 'gdp' | 'gdp_per_capita';

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

const PER_PAGE = 100;

export function DataExplorer({ jobId }: Props) {
  const [dataset, setDataset] = useState<Dataset>('gdp');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [industryFilter, setIndustryFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const gdpQuery = useGDPTable(
    dataset === 'gdp' ? jobId : null,
    {
      state: stateFilter || undefined,
      industry: industryFilter || undefined,
      page,
      per_page: PER_PAGE,
    }
  );

  const perCapitaQuery = useGDPPerCapitaTable(
    dataset === 'gdp_per_capita' ? jobId : null,
    {
      state: stateFilter || undefined,
      industry: industryFilter || undefined,
      page,
      per_page: PER_PAGE,
    }
  );

  const activeQuery = dataset === 'gdp' ? gdpQuery : perCapitaQuery;
  const totalPages = activeQuery.data ? Math.ceil(activeQuery.data.total / PER_PAGE) : 0;
  const totalRows = activeQuery.data?.total || 0;

  const handleDatasetChange = (value: string | null) => {
    if (value === 'gdp' || value === 'gdp_per_capita') {
      setDataset(value);
      setPage(1);
    }
  };

  const handleStateChange = (value: string | null) => {
    if (!value) return;
    setStateFilter(value === '__all__' ? '' : value);
    setPage(1);
  };

  const handleIndustryChange = (value: string | null) => {
    if (!value) return;
    setIndustryFilter(value === '__all__' ? '' : value);
    setPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Explorer</CardTitle>
        <CardDescription>
          Browse the full forecast dataset with filtering and pagination
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Dataset:</span>
            <Select value={dataset} onValueChange={handleDatasetChange}>
              <SelectTrigger className="w-[200px]">
                <span data-slot="select-value" className="flex flex-1 text-left line-clamp-1">
                  {dataset === 'gdp' ? 'GDP by State-Industry' : 'GDP per Capita'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gdp">GDP by State-Industry</SelectItem>
                <SelectItem value="gdp_per_capita">GDP per Capita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">State:</span>
            <Select value={stateFilter || '__all__'} onValueChange={handleStateChange}>
              <SelectTrigger className="w-[180px]">
                <span data-slot="select-value" className="flex flex-1 text-left line-clamp-1">
                  {stateFilter || 'All States'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All States</SelectItem>
                {STATES_LIST.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Industry:</span>
            <Select value={industryFilter || '__all__'} onValueChange={handleIndustryChange}>
              <SelectTrigger className="w-[200px]">
                <span data-slot="select-value" className="flex flex-1 text-left line-clamp-1">
                  {industryFilter ? (INDUSTRY_SHORT_NAMES[industryFilter] || industryFilter) : 'All Industries'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Industries</SelectItem>
                {LEAF_INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {INDUSTRY_SHORT_NAMES[ind] || ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge variant="secondary" className="ml-auto">
            {totalRows.toLocaleString()} rows
          </Badge>
        </div>

        {/* Table */}
        {activeQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : dataset === 'gdp' && gdpQuery.data ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarter</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Real GDP</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gdpQuery.data.data.map((row, i) => (
                  <TableRow key={`${row.quarter}-${row.state}-${row.industry}-${i}`}>
                    <TableCell className="font-mono text-xs">{row.quarter}</TableCell>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="text-xs">{row.state}</TableCell>
                    <TableCell className="text-xs">{INDUSTRY_SHORT_NAMES[row.industry] || row.industry}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatGDP(row.real_gdp)}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_forecast ? 'default' : 'secondary'} className="text-[10px]">
                        {row.is_forecast ? 'Forecast' : 'Historical'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : dataset === 'gdp_per_capita' && perCapitaQuery.data ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Real GDP</TableHead>
                  <TableHead className="text-right">Population</TableHead>
                  <TableHead className="text-right">GDP/Capita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perCapitaQuery.data.data.map((row, i) => (
                  <TableRow key={`${row.year}-${row.state}-${row.industry}-${i}`}>
                    <TableCell className="font-mono text-xs">{row.year}</TableCell>
                    <TableCell className="text-xs">{row.state}</TableCell>
                    <TableCell className="text-xs">{INDUSTRY_SHORT_NAMES[row.industry] || row.industry}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatGDP(row.real_gdp)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatPopulation(row.population)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatPerCapita(row.gdp_per_capita)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No data available
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
