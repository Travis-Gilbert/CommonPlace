// SOURCING: rustyred-thg-schema RecordVerb::Aggregate (SPEC-MODEL-CANVAS-RECORDS RT5).
// Maps console Calculate footer ops onto generated aggregate_{plural} tools.

import type { ObjectAction, ObjectActionReceipt, Result } from '@commonplace/block-view/types';
import type { AggregateOp } from './schemaColumns';

export type AggregateEmit = (
  action: ObjectAction,
) => Promise<Result<ObjectActionReceipt>>;

/** snake_case for generated tool suffixes (name_plural / name_singular). */
export function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
}

/** Console AggregateOp -> schema Aggregate op string. */
export function toSchemaAggregateOp(op: AggregateOp): string {
  return op === 'avg' ? 'average' : op;
}

export function aggregateToolName(namePlural: string): string {
  return `aggregate_${snakeCase(namePlural)}`;
}

export function updateOneToolName(nameSingular: string): string {
  return `update_one_${snakeCase(nameSingular)}`;
}

export type AggregateInvokeResult = {
  readonly field: string;
  readonly op: string;
  readonly available: boolean;
  readonly value?: unknown;
  readonly reason?: string;
};

function receiptPayload(receipt: ObjectActionReceipt): unknown {
  const record = receipt as ObjectActionReceipt & {
    result?: unknown;
    payload?: unknown;
    structuredContent?: unknown;
  };
  if (record.result !== undefined) return record.result;
  if (record.payload !== undefined) return record.payload;
  if (record.structuredContent !== undefined) return record.structuredContent;
  if (typeof record.note === 'string' && record.note.trim().startsWith('{')) {
    try {
      return JSON.parse(record.note) as unknown;
    } catch {
      return record;
    }
  }
  return record;
}

/** Invoke one aggregate_{plural} call; returns unavailable on transport refusal. */
export async function invokeAggregate(
  emit: AggregateEmit,
  namePlural: string,
  field: string,
  op: AggregateOp,
  filters: Record<string, unknown> = {},
): Promise<AggregateInvokeResult> {
  const tool = aggregateToolName(namePlural);
  const schemaOp = toSchemaAggregateOp(op);
  try {
    const outcome = await emit({
      kind: 'invoke_tool',
      tool,
      args: {
        field,
        op: schemaOp,
        ...filters,
      },
    });
    if (!outcome.ok || !outcome.value) {
      return {
        field,
        op: schemaOp,
        available: false,
        reason: outcome.error ?? 'Aggregate invoke refused',
      };
    }
    const payload = receiptPayload(outcome.value);
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return {
        field,
        op: schemaOp,
        available: false,
        reason: 'Aggregate response was not an object',
      };
    }
    const record = payload as Record<string, unknown>;
    return {
      field,
      op: schemaOp,
      available: record.available !== false,
      value: record.value,
      ...(typeof record.reason === 'string' ? { reason: record.reason } : {}),
    };
  } catch (error) {
    return {
      field,
      op: schemaOp,
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
