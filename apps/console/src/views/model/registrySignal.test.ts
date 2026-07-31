import { describe, expect, it } from 'vitest';
import type { DeclaredModel, SchemaVersion } from '@commonplace/data-model-contracts';
import {
  UNKNOWN_REGISTRY_SIGNAL,
  registryMoved,
  registrySignal,
} from './registrySignal';

const scope = { kind: 'topic', topicId: 't1' } as const;

function version(patch: Partial<SchemaVersion>): SchemaVersion {
  return {
    id: 'v1',
    scope,
    version: 1,
    status: 'superseded',
    objectTypeIds: [],
    fieldIds: [],
    relationIds: [],
    viewIds: [],
    ...patch,
  };
}

function declared(versions: SchemaVersion[]): DeclaredModel {
  return {
    scope,
    objectTypes: [],
    fields: [],
    relations: [],
    views: [],
    divergences: [],
    versions,
  };
}

describe('registrySignal', () => {
  it('reads the declared head, not merely the last element', () => {
    const signal = registrySignal(declared([
      version({ id: 'v2', version: 2, status: 'declared', contentAnchor: 'anchor-2' }),
      version({ id: 'v1', version: 1, status: 'superseded', contentAnchor: 'anchor-1' }),
    ]));
    expect(signal).toEqual({ version: 2, contentAnchor: 'anchor-2' });
  });

  it('prefers the highest sequence when several claim to be declared', () => {
    const signal = registrySignal(declared([
      version({ id: 'v2', version: 2, status: 'declared', contentAnchor: 'anchor-2' }),
      version({ id: 'v7', version: 7, status: 'declared', contentAnchor: 'anchor-7' }),
    ]));
    expect(signal.version).toBe(7);
  });

  it('parses a string sequence and falls back to the id when no anchor is given', () => {
    const signal = registrySignal(declared([
      version({ id: 'v9', version: '9', status: 'declared' }),
    ]));
    expect(signal).toEqual({ version: 9, contentAnchor: 'v9' });
  });

  it('reports unknown for an empty registry', () => {
    expect(registrySignal(declared([]))).toEqual(UNKNOWN_REGISTRY_SIGNAL);
  });
});

describe('registryMoved', () => {
  const at = (v: number, anchor: string) => ({ version: v, contentAnchor: anchor });

  it('moves when the sequence advances', () => {
    expect(registryMoved(at(1, 'a'), at(2, 'b'))).toBe(true);
  });

  it('moves when only the anchor changes, which a restore can do', () => {
    expect(registryMoved(at(4, 'a'), at(4, 'b'))).toBe(true);
  });

  it('does not move when the registry is unchanged', () => {
    expect(registryMoved(at(4, 'a'), at(4, 'a'))).toBe(false);
  });

  it('treats an unresolvable signal as no movement on either side', () => {
    // A read that could not resolve a version must not look like a change, or
    // a failing endpoint would drive an endless rehydrate loop.
    expect(registryMoved(at(4, 'a'), UNKNOWN_REGISTRY_SIGNAL)).toBe(false);
    expect(registryMoved(UNKNOWN_REGISTRY_SIGNAL, at(4, 'a'))).toBe(false);
  });
});
