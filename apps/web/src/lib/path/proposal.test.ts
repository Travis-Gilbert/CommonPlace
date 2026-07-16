// SOURCING: none — pure logic, no upstream component applies
import { describe, expect, it, vi } from 'vitest';
import {
  applyPathProposal,
  buildProposalDiff,
  draftPathProposal,
  proposalSignalIds,
  rollbackPathProposal,
  type PathProposalClients,
  type PathProposalDraft,
} from './proposal';

function stubClients(overrides: Partial<PathProposalClients> = {}): PathProposalClients {
  return {
    validateOrProject: vi.fn(async () => ({ ok: true, projection: { nodes: [] } })),
    applyProgram: vi.fn(async () => ({ ok: true })),
    compileVersion: vi.fn(async () => ({
      commitId: 'commit-2',
      repository: { commits: ['commit-1', 'commit-2'] },
    })),
    checkoutVersion: vi.fn(async () => ({ ok: true, snapshot: { nodes: [] } })),
    versionLog: vi.fn(async () => ['commit-1', 'commit-2']),
    ...overrides,
  };
}

const draft: PathProposalDraft = {
  title: 'Curriculum slice',
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { source: 'a', target: 'b', kind: 'PREREQUISITE' },
    { source: 'b', target: 'c', kind: 'PREREQUISITE' },
  ],
};

describe('path proposal PL4', () => {
  it('builds a reviewable diff before any write', async () => {
    const clients = stubClients();
    const review = await draftPathProposal(draft, ['a', 'z'], clients, [
      { source: 'z', target: 'a', kind: 'RELATED' },
    ]);
    expect(review.diff.addedNodes.map((n) => n.id)).toEqual(['b', 'c']);
    expect(review.diff.removedNodes.map((n) => n.id)).toEqual(['z']);
    expect(review.validated).toBe(true);
    expect(clients.applyProgram).not.toHaveBeenCalled();
    expect(clients.compileVersion).not.toHaveBeenCalled();
  });

  it('apply materializes then compiles a graph-version commit', async () => {
    const clients = stubClients();
    const review = await draftPathProposal(draft, ['a'], clients);
    const applied = await applyPathProposal(review, clients, {
      message: 'apply curriculum',
      parentCommits: ['commit-1'],
    });
    expect(clients.applyProgram).toHaveBeenCalledOnce();
    expect(clients.compileVersion).toHaveBeenCalledOnce();
    expect(applied.commitId).toBe('commit-2');
    expect(applied.parentCommitId).toBe('commit-1');
  });

  it('rollback checks out the prior commit', async () => {
    const clients = stubClients();
    const result = await rollbackPathProposal({ branch: 'main' }, 'commit-1', clients);
    expect(result.ok).toBe(true);
    expect(clients.checkoutVersion).toHaveBeenCalledWith({
      repository: { branch: 'main' },
      target: 'commit-1',
    });
  });

  it('signal ids light proposed nodes; ink covers existing', () => {
    const diff = buildProposalDiff(draft, ['a']);
    const { signalNodeIds, inkNodeIds } = proposalSignalIds(diff);
    expect(signalNodeIds.has('b')).toBe(true);
    expect(signalNodeIds.has('c')).toBe(true);
    expect(inkNodeIds.has('a')).toBe(true);
    expect(signalNodeIds.has('a')).toBe(false);
  });
});
