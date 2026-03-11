'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SliderWithInputProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  displayAsPercent?: boolean;
  className?: string;
}

export function SliderWithInput({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  displayAsPercent = false,
  className,
}: SliderWithInputProps) {
  // Decimal places for the raw value (from step precision)
  const decimals = React.useMemo(() => {
    const stepStr = step.toString();
    const dotIndex = stepStr.indexOf('.');
    return dotIndex === -1 ? 0 : stepStr.length - dotIndex - 1;
  }, [step]);

  // Decimal places for the percentage display (2 fewer than raw)
  const percentDecimals = React.useMemo(() => {
    const stepStr = step.toString();
    const dotIndex = stepStr.indexOf('.');
    const rawDecimals = dotIndex === -1 ? 0 : stepStr.length - dotIndex - 1;
    return Math.max(0, rawDecimals - 2);
  }, [step]);

  // When displayAsPercent, the input shows/edits in percentage units (value * 100)
  // The slider always works with raw decimal values
  const inputDecimals = displayAsPercent ? percentDecimals : decimals;
  const inputMin = displayAsPercent ? min * 100 : min;
  const inputMax = displayAsPercent ? max * 100 : max;
  const inputStep = displayAsPercent ? step * 100 : step;
  const inputValue = displayAsPercent ? value * 100 : value;

  const handleSliderChange = React.useCallback(
    (newValue: number | readonly number[]) => {
      const val = Array.isArray(newValue) ? newValue[0] : newValue;
      onChange(parseFloat(val.toFixed(decimals)));
    },
    [onChange, decimals]
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '' || raw === '-') return;
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) return;
      const clamped = Math.min(inputMax, Math.max(inputMin, parsed));
      const realValue = displayAsPercent ? clamped / 100 : clamped;
      onChange(parseFloat(realValue.toFixed(decimals)));
    },
    [onChange, inputMin, inputMax, decimals, displayAsPercent]
  );

  const handleInputBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) {
        onChange(min);
        return;
      }
      const clamped = Math.min(inputMax, Math.max(inputMin, parsed));
      const realValue = displayAsPercent ? clamped / 100 : clamped;
      onChange(parseFloat(realValue.toFixed(decimals)));
    },
    [onChange, min, inputMin, inputMax, decimals, displayAsPercent]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <Tooltip>
            <TooltipTrigger
              className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Slider
            value={[value]}
            onValueChange={handleSliderChange}
            min={min}
            max={max}
            step={step}
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            value={inputValue.toFixed(inputDecimals)}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            min={inputMin}
            max={inputMax}
            step={inputStep}
            className="w-20 h-7 text-xs text-center tabular-nums"
          />
          {displayAsPercent && (
            <span className="text-xs text-muted-foreground">%</span>
          )}
        </div>
      </div>
    </div>
  );
}
