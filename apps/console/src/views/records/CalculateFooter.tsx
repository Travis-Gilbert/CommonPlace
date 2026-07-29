'use client';

// SOURCING: Twenty calculate footer (per-column aggregate selectors).
// Honest loading and unavailable states; never fabricates aggregate values.

import type { FieldType } from '@commonplace/data-model-contracts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { aggregateOpsForField, type AggregateOp } from './schemaColumns';

export type AggregateCellStatus = 'loading' | 'value' | 'unavailable';

export interface AggregateCellValue {
  readonly status: AggregateCellStatus;
  readonly value?: unknown;
  readonly reason?: string;
}

export interface CalculateFooterProps {
  readonly columns: readonly { fieldKey: string; fieldType: FieldType }[];
  readonly values: Readonly<Record<string, AggregateCellValue>>;
  readonly onSelectOp: (fieldKey: string, op: AggregateOp) => void;
  readonly selectedOps?: Readonly<Record<string, AggregateOp>>;
}

function formatAggregateValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function CalculateFooter({
  columns,
  values,
  onSelectOp,
  selectedOps = {},
}: CalculateFooterProps) {
  if (columns.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-stretch border-t border-ij-seam bg-ij-chrome"
      data-calculate-footer
    >
      <div className="flex w-full items-center overflow-x-auto">
        {columns.map((column) => {
          const cell = values[column.fieldKey] ?? { status: 'unavailable', reason: 'No aggregate' };
          const ops = aggregateOpsForField(column.fieldType);
          const selected = selectedOps[column.fieldKey] ?? ops[0] ?? 'count';
          return (
            <div
              key={column.fieldKey}
              className="flex min-w-28 shrink-0 flex-col gap-1 border-r border-ij-divider px-rec-cell-pad py-1 last:border-r-0"
            >
              <Select
                value={selected}
                onValueChange={(op) => onSelectOp(column.fieldKey, op as AggregateOp)}
              >
                <SelectTrigger size="sm" className="h-6 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="truncate font-ij-mono text-xs text-ij-ink-info">
                {cell.status === 'loading'
                  ? 'Loading...'
                  : cell.status === 'unavailable'
                    ? cell.reason ?? 'Unavailable'
                    : formatAggregateValue(cell.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
