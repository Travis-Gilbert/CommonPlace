// SOURCING: none. Vitest for RT5 aggregate tool naming and emit mapping.

import { describe, expect, it, vi } from 'vitest';
import {
  aggregateToolName,
  invokeAggregate,
  snakeCase,
  toSchemaAggregateOp,
  updateOneToolName,
} from './aggregates';

describe('aggregates helpers', () => {
  it('snake_cases plurals for generated tool names', () => {
    expect(snakeCase('ActiveCompanies')).toBe('active_companies');
    expect(aggregateToolName('Companies')).toBe('aggregate_companies');
    expect(updateOneToolName('Company')).toBe('update_one_company');
  });

  it('maps avg to average for the schema Aggregate op', () => {
    expect(toSchemaAggregateOp('avg')).toBe('average');
    expect(toSchemaAggregateOp('sum')).toBe('sum');
  });

  it('invokes aggregate_{plural} and returns the tool payload', async () => {
    const emit = vi.fn(async () => ({
      ok: true as const,
      value: {
        action_kind: 'invoke_tool' as const,
        status: 'applied' as const,
        legacy_without_op_range: true as const,
        result: { field: 'amount', op: 'sum', available: true, value: 42 },
      },
    }));
    const result = await invokeAggregate(emit, 'Invoices', 'amount', 'sum', { status: 'open' });
    expect(emit).toHaveBeenCalledWith({
      kind: 'invoke_tool',
      tool: 'aggregate_invoices',
      args: { field: 'amount', op: 'sum', status: 'open' },
    });
    expect(result).toEqual({
      field: 'amount',
      op: 'sum',
      available: true,
      value: 42,
    });
  });

  it('does not treat a page-length count as a fabricated total when the tool returns a larger value', async () => {
    const pageIds = ['a', 'b'];
    const emit = vi.fn(async () => ({
      ok: true as const,
      value: {
        action_kind: 'invoke_tool' as const,
        status: 'applied' as const,
        legacy_without_op_range: true as const,
        result: { field: 'id', op: 'count', available: true, value: 9 },
      },
    }));
    const result = await invokeAggregate(emit, 'Companies', 'id', 'count');
    expect(result.value).toBe(9);
    expect(result.value).not.toBe(pageIds.length);
  });
});
