// SOURCING: none — pure logic, no upstream component applies
import { describe, expect, it, vi } from 'vitest';
import {
  formatPathReadout,
  pathTo,
  type PathClients,
} from './pathTo';
import { pathChainEdgeKeys, pathChainIdSet, pathOpacityFor } from './pathLens';

function stubClients(overrides: Partial<PathClients> = {}): PathClients {
  return {
    whyDerivationTrace: vi.fn(async () => ({
      chain: [
        { id: 'assume-1', label: 'A0' },
        { id: 'derive-1', label: 'D1' },
        { id: 'claim-1', label: 'C1' },
      ],
    })),
    foldSemiringTropical: vi.fn(async () => ({ distance: 2 })),
    planBlocked: vi.fn(async () => ({
      blocked_set: ['task-a', 'task-b'],
      status: 'blocked',
    })),
    memorySupport: vi.fn(async () => ({
      support: [{ id: 'mem-1' }, { id: 'claim-1' }],
    })),
    codeReach: vi.fn(async () => ({
      reaches: [{ id: 'sym-root' }, { id: 'sym-leaf' }],
    })),
    ...overrides,
  };
}

describe('pathTo', () => {
  it('derivation returns why chain plus tropical distance', async () => {
    const clients = stubClients();
    const result = await pathTo('claim-1', 'derivation', clients);
    expect(result.chain.map((n) => n.id)).toEqual(['assume-1', 'derive-1', 'claim-1']);
    expect(result.depth).toBe(2);
    expect(result.distance).toBe(2);
    expect(result.status).toBe('ready');
    expect(result.blockedBy).toEqual([]);
    expect(result.label).toBe('why this is believed');
    expect(clients.whyDerivationTrace).toHaveBeenCalledWith('claim-1');
    expect(clients.foldSemiringTropical).toHaveBeenCalledWith('claim-1');
  });

  it('plan returns blocked_set as blockedBy', async () => {
    const result = await pathTo('task-x', 'plan', stubClients());
    expect(result.blockedBy.map((n) => n.id)).toEqual(['task-a', 'task-b']);
    expect(result.status).toBe('blocked');
    expect(result.label).toBe('what blocks this');
    expect(result.distance).toBe(2);
  });

  it('memory and code scopes only change the label and resolver', async () => {
    const memory = await pathTo('claim-1', 'memory', stubClients());
    const code = await pathTo('sym-leaf', 'code', stubClients());
    expect(memory.label).toBe('what supports this claim');
    expect(code.label).toBe('what reaches this symbol');
    expect(memory.scope).toBe('memory');
    expect(code.scope).toBe('code');
  });

  it('readout wording comes from the scope label', async () => {
    const result = await pathTo('claim-1', 'derivation', stubClients());
    expect(formatPathReadout(result)).toBe(
      'derivation · depth 2 · distance 2 · blocked by 0 · why this is believed',
    );
  });
});

describe('pathLens', () => {
  it('dims non-ancestors and lights the chain', async () => {
    const result = await pathTo('claim-1', 'derivation', stubClients());
    const chain = pathChainIdSet(result);
    expect(pathOpacityFor('claim-1', 'claim-1', chain)).toBe(1);
    expect(pathOpacityFor('assume-1', 'claim-1', chain)).toBe(1);
    expect(pathOpacityFor('noise', 'claim-1', chain)).toBeLessThan(0.2);
    expect(pathChainEdgeKeys(result).has('assume-1|derive-1')).toBe(true);
  });
});
