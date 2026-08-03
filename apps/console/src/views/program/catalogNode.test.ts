import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '@commonplace/program-contracts';
import { programNodeFromCatalog } from './catalogNode';

function entry(patch: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'theorem.code.quickjs',
    group: 'code',
    source: { library: 'rustyred-thg-code-mode', version: 'workspace' },
    fit_state: 'stateless',
    input_shape: { kind: 'tabular_any' },
    output_shape: { kind: 'tabular_any' },
    lifecycle: 'beta',
    node_kind: 'stochastic',
    authoring_runtime: 'quick_js',
    contract: {
      id: 'contract:quickjs',
      name: 'QuickJS',
      version: '1',
      description: 'Sandboxed code',
      capabilities: [],
    },
    input_ports: [{ id: 'in', shape_id: 'json' }],
    output_ports: [{ id: 'out', shape_id: 'json' }],
    ...patch,
  };
}

describe('programNodeFromCatalog', () => {
  it('keeps contract and ports from the server catalog', () => {
    const node = programNodeFromCatalog(entry(), 'node:one');
    expect(node.block_id).toBe('theorem.code.quickjs');
    expect(node.contract.id).toBe('contract:quickjs');
    expect(node.inputs).toEqual([{ id: 'in', shape_id: 'json' }]);
    expect(node.kind).toBe('stochastic');
  });

  it('binds a published program through its catalog identity', () => {
    const node = programNodeFromCatalog(entry({
      id: 'published:monitor',
      published_program_id: 'program:abc',
    }), 'node:published');
    expect(node).toMatchObject({
      kind: 'stochastic',
      affordance_id: 'program:abc',
    });
  });

  it('refuses incomplete catalog records instead of inventing ports', () => {
    expect(() => programNodeFromCatalog(entry({ contract: undefined }), 'node:bad'))
      .toThrow('has no authoring contract');
  });

  it('refuses Compound catalog inserts', () => {
    expect(() => programNodeFromCatalog(entry({ node_kind: 'compound' }), 'node:compound'))
      .toThrow('expand an atom');
  });
});
