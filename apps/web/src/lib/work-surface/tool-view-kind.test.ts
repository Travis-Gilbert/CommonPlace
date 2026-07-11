import { describe, expect, it } from 'vitest';
import { objectQueryForFocalIds, resolveToolViewKind } from './tool-view-kind';
import type { WorkToolPart } from './types';

function part(overrides: Partial<WorkToolPart>): WorkToolPart {
  return {
    toolCallId: 'c1',
    toolName: 'retrieval',
    args: {},
    status: 'complete',
    ...overrides,
  };
}

describe('resolveToolViewKind', () => {
  it('recognizes memory_recall regardless of status', () => {
    expect(resolveToolViewKind(part({ toolName: 'memory_recall', status: 'running' }))).toBe(
      'memory-recall',
    );
    expect(resolveToolViewKind(part({ toolName: 'memory_recall', status: 'complete' }))).toBe(
      'memory-recall',
    );
  });

  it('recognizes coordination_ping regardless of status', () => {
    expect(resolveToolViewKind(part({ toolName: 'coordination_ping' }))).toBe('coordination-ping');
  });

  it('recognizes a completed objects part carrying focal_object_ids as object-set', () => {
    expect(
      resolveToolViewKind(
        part({ toolName: 'objects', result: { object_count: 2, focal_object_ids: [1, 2] } }),
      ),
    ).toBe('object-set');
  });

  it('falls back to status for a running objects part (no result yet)', () => {
    expect(resolveToolViewKind(part({ toolName: 'objects', status: 'running' }))).toBe('status');
  });

  it('falls back to status when focal_object_ids is empty', () => {
    expect(
      resolveToolViewKind(part({ toolName: 'objects', result: { object_count: 0, focal_object_ids: [] } })),
    ).toBe('status');
  });

  it('falls back to status for the other Theseus stage tool names', () => {
    for (const toolName of ['pipeline', 'classify', 'retrieval', 'simulation', 'expression']) {
      expect(resolveToolViewKind(part({ toolName }))).toBe('status');
    }
  });
});

describe('objectQueryForFocalIds', () => {
  it('builds an OR-of-eq ObjectQuery from real focal ids', () => {
    const query = objectQueryForFocalIds(
      part({ toolName: 'objects', result: { focal_object_ids: [10, 11] } }),
    );
    expect(query).toEqual({
      types: [],
      where: {
        kind: 'or',
        any: [
          { kind: 'eq', field: 'id', value: '10' },
          { kind: 'eq', field: 'id', value: '11' },
        ],
      },
    });
  });

  it('returns null when there are no focal ids', () => {
    expect(objectQueryForFocalIds(part({ toolName: 'objects', result: { focal_object_ids: [] } }))).toBeNull();
    expect(objectQueryForFocalIds(part({ toolName: 'retrieval' }))).toBeNull();
  });
});
