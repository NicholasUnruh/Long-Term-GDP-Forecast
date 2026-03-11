'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGDP, formatPopulation, formatPercent, formatPerCapita } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { CAGRRow } from '@/lib/types';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface Props {
  data: CAGRRow[] | undefined;
  isLoading: boolean;
  onStateSelect: (state: string) => void;
}

type SortField = 'state' | 'gdp_end' | 'gdp_per_capita_end' | 'cagr' | 'population_end';
type SortDirection = 'asc' | 'desc';

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField; direction: SortDirection }) {
  if (field !== currentField) {
    return <ArrowUpDown className="ml-1 h-3 w-3 inline-block opacity-40" />;
  }
  return direction === 'asc'
    ? <ArrowUp className="ml-1 h-3 w-3 inline-block" />
    : <ArrowDown className="ml-1 h-3 w-3 inline-block" />;
}

export function CAGRByStateTable({ data, isLoading, onStateSelect }: Props) {
  const [sortField, setSortField] = useState<SortField>('cagr');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      // Always keep "United States" at the top
      if (a.state === 'United States') return -1;
      if (b.state === 'United States') return 1;

      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [data, sortField, sortDirection]);

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: 'state', label: 'State' },
    { field: 'gdp_end', label: '2050 GDP' },
    { field: 'gdp_per_capita_end', label: 'GDP/Capita' },
    { field: 'cagr', label: 'CAGR' },
    { field: 'population_end', label: 'Population' },
  ];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.field}
                className="cursor-pointer select-none hover:bg-muted/50"
                onClick={() => handleSort(col.field)}
              >
                {col.label}
                <SortIcon field={col.field} currentField={sortField} direction={sortDirection} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row) => (
            <TableRow
              key={row.state}
              className={cn(
                'cursor-pointer',
                row.state === 'United States' && 'bg-muted/60 font-semibold'
              )}
              onClick={() => onStateSelect(row.state)}
            >
              <TableCell className="font-medium">{row.state}</TableCell>
              <TableCell>{formatGDP(row.gdp_end)}</TableCell>
              <TableCell>{formatPerCapita(row.gdp_per_capita_end)}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    'font-medium',
                    row.cagr >= 0 ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  {formatPercent(row.cagr)}
                </span>
              </TableCell>
              <TableCell>{formatPopulation(row.population_end)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
