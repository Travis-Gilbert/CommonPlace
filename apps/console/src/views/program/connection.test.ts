import { describe, expect, it } from 'vitest';
import {
  catalogEntryAcceptsBoundary,
  edgeSchemaValidationFromResponse,
  schemaMismatchMessage,
  typesCompatibleClient,
} from './connection';

describe('program connection compatibility', () => {
  it('accepts matching shapes and rejects different shape classes', () => {
    expect(typesCompatibleClient('tabular_any', { kind: 'tabular_any' })).toBe(true);
    expect(typesCompatibleClient('graph_nodes', { kind: 'tabular_any' })).toBe(false);
  });

  it('filters palette entries by an active boundary', () => {
    const entry = {
      id: 'tabular',
      group: 'transform',
      source: { library: 'test', version: '1' },
      fit_state: 'stateless' as const,
      input_shape: { kind: 'tabular_any' as const },
      output_shape: { kind: 'tabular_any' as const },
      lifecycle: 'stable' as const,
      input_ports: [{ id: 'in', shape_id: 'tabular_any' }],
      output_ports: [{ id: 'out', shape_id: 'tabular_any' }],
    };
    expect(catalogEntryAcceptsBoundary(entry, 'tabular_any')).toBe(true);
    expect(catalogEntryAcceptsBoundary(entry, 'graph_nodes')).toBe(false);
  });

  it('preserves the server schema-validation tri-state and mismatch detail', () => {
    expect(edgeSchemaValidationFromResponse({ status: 'compatible' })).toEqual({
      status: 'compatible',
    });
    expect(edgeSchemaValidationFromResponse({ status: 'undetermined' })).toEqual({
      status: 'undetermined',
    });

    const validation = edgeSchemaValidationFromResponse({
      status: 'mismatch',
      mismatch: {
        column: 'age',
        producer_shape: 'users',
        consumer_shape: 'adult_users',
        producer_detail: 'nullable text',
        consumer_detail: 'non-null number',
      },
    });
    expect(validation.status).toBe('mismatch');
    if (validation.status !== 'mismatch' || !validation.mismatch) throw new Error('missing mismatch');
    expect(schemaMismatchMessage(validation.mismatch)).toBe(
      'Schema mismatch on age: users emits nullable text; adult_users requires non-null number.',
    );
  });

  it('refuses malformed server schema-validation responses', () => {
    expect(() => edgeSchemaValidationFromResponse({ status: 'mismatch' })).toThrow(
      'invalid schema mismatch',
    );
    expect(() => edgeSchemaValidationFromResponse({ status: 'unknown' })).toThrow(
      'unknown schema status',
    );
  });
});
