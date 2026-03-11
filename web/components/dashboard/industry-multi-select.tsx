'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LEAF_INDUSTRIES, INDUSTRY_SHORT_NAMES } from '@/lib/constants';
import { ChevronDown, Check, X } from 'lucide-react';

interface Props {
  selected: string[];
  onChange: (industries: string[]) => void;
}

const ALL_INDUSTRY = 'All industry total';

export function IndustryMultiSelect({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selected.includes(ALL_INDUSTRY);

  const toggleIndustry = (industry: string) => {
    if (industry === ALL_INDUSTRY) {
      if (isAllSelected) {
        onChange(selected.filter((s) => s !== ALL_INDUSTRY));
      } else {
        onChange([...selected.filter((s) => s !== ALL_INDUSTRY), ALL_INDUSTRY]);
      }
      return;
    }

    if (selected.includes(industry)) {
      const next = selected.filter((s) => s !== industry);
      if (next.length === 0) next.push(ALL_INDUSTRY);
      onChange(next);
    } else {
      if (selected.length >= 8) return;
      onChange([...selected, industry]);
    }
  };

  const clearAll = () => {
    onChange([ALL_INDUSTRY]);
  };

  const label = () => {
    if (selected.length === 1 && isAllSelected) return 'All Industry Total';
    if (selected.length === 1)
      return INDUSTRY_SHORT_NAMES[selected[0]] || selected[0];
    return `${selected.length} industries`;
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        className="w-[220px] justify-between text-sm font-normal"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{label()}</span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-[280px] rounded-lg border bg-popover shadow-md">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Select up to 8 industries
            </span>
            {!(selected.length === 1 && isAllSelected) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                <X className="inline h-3 w-3 mr-0.5" />
                Clear
              </button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto p-1">
            <SelectRow
              label="All Industry Total"
              checked={isAllSelected}
              onClick={() => toggleIndustry(ALL_INDUSTRY)}
              disabled={false}
            />
            <div className="my-1 h-px bg-border" />
            {LEAF_INDUSTRIES.map((ind) => (
              <SelectRow
                key={ind}
                label={INDUSTRY_SHORT_NAMES[ind] || ind}
                checked={selected.includes(ind)}
                onClick={() => toggleIndustry(ind)}
                disabled={!selected.includes(ind) && selected.length >= 8}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectRow({
  label,
  checked,
  onClick,
  disabled,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
        disabled && !checked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={disabled && !checked ? undefined : onClick}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
