// SOURCING: none. Client mirror of types_compatible; server validate_edge_schema is law.

import type { CatalogEntry, ShapeSpec } from '@commonplace/program-contracts';
import { shapeClassFor } from './shapeHue';

export type EdgeSchemaStatus = 'compatible' | 'undetermined' | 'mismatch';

export type SchemaMismatch = {
  readonly column: string;
  readonly producer_shape: string;
  readonly consumer_shape: string;
  readonly producer_detail: string;
  readonly consumer_detail: string;
};

export type EdgeSchemaValidation = {
  readonly status: EdgeSchemaStatus;
  readonly mismatch?: SchemaMismatch;
};

/** Advisory client filter: same shape class is treated as compatible enough for drag feedback. */
export function typesCompatibleClient(
  producer: ShapeSpec | string | undefined,
  consumer: ShapeSpec | string | undefined,
): boolean {
  if (!producer || !consumer) return true;
  return shapeClassFor(producer) === shapeClassFor(consumer);
}

export function catalogEntryAcceptsBoundary(
  entry: CatalogEntry,
  boundary: ShapeSpec | string | undefined,
): boolean {
  if (!boundary) return true;
  return typesCompatibleClient(boundary, entry.input_shape);
}

export function edgeSchemaValidationFromResponse(value: Record<string, unknown>): EdgeSchemaValidation {
  const status = value.status;
  if (status === 'compatible' || status === 'undetermined') return { status };
  if (status === 'mismatch') {
    const mismatch = value.mismatch;
    if (
      !mismatch
      || typeof mismatch !== 'object'
      || Array.isArray(mismatch)
    ) {
      throw new Error('validate_edge returned an invalid schema mismatch');
    }
    const record = mismatch as Record<string, unknown>;
    if (
      typeof record.column !== 'string'
      || typeof record.producer_shape !== 'string'
      || typeof record.consumer_shape !== 'string'
      || typeof record.producer_detail !== 'string'
      || typeof record.consumer_detail !== 'string'
    ) {
      throw new Error('validate_edge returned an invalid schema mismatch');
    }
    return {
      status,
      mismatch: {
        column: record.column,
        producer_shape: record.producer_shape,
        consumer_shape: record.consumer_shape,
        producer_detail: record.producer_detail,
        consumer_detail: record.consumer_detail,
      },
    };
  }
  throw new Error('validate_edge returned an unknown schema status');
}

export function schemaMismatchMessage(mismatch: SchemaMismatch): string {
  return `Schema mismatch on ${mismatch.column}: ${mismatch.producer_shape} emits ${mismatch.producer_detail}; ${mismatch.consumer_shape} requires ${mismatch.consumer_detail}.`;
}
