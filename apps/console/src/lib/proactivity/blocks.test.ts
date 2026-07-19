// SOURCING: @vitest. The typed-block decomposition (the node-model grammar). A
// block is what a node is made of, its vocabulary is fixed by the host kind, and
// the grammar forbids cross-type drops. These tests pin the grammar, the
// hand-add vs compile-from-intent split, and the pure decompile over the real
// fixture (so the blocks stay a view of the same fields, never a parallel store).

import { describe, expect, it } from 'vitest';
import { blocksForNode, isCompileOnly, legalBlockTypes } from './blocks';
import { FIXTURE_TENANT, seedStandingStructure } from './fixtures';
import { projectProactivityGraph } from './projection';
import { isRefusal, type ProjectedNode } from './model';

function project(): readonly ProjectedNode[] {
  const result = projectProactivityGraph(FIXTURE_TENANT, seedStandingStructure());
  if (isRefusal(result)) throw new Error('fixture projection refused');
  return result.nodes;
}

function node(id: string): ProjectedNode {
  const found = project().find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no fixture node ${id}`);
  return found;
}

describe('the grammar: legal block types by host kind', () => {
  it('fixes each kind vocabulary', () => {
    expect(legalBlockTypes('watch')).toEqual(['match', 'threshold', 'and_or', 'not', 'stopping']);
    expect(legalBlockTypes('judgment')).toEqual(['policy']);
    expect(legalBlockTypes('response')).toEqual(['prepare', 'verify', 'action', 'custom']);
    expect(legalBlockTypes('stake')).toEqual(['stopping']);
    expect(legalBlockTypes('source')).toEqual([]);
    expect(legalBlockTypes('assumption')).toEqual([]);
  });

  it('forbids cross-type drops (the constraint is the lesson)', () => {
    expect(legalBlockTypes('judgment')).not.toContain('action');
    expect(legalBlockTypes('watch')).not.toContain('policy');
    expect(legalBlockTypes('response')).not.toContain('match');
  });
});

describe('hand-add vs compile-from-intent', () => {
  it('adds prepare and verify directly, compiles the rest from intent', () => {
    expect(isCompileOnly('prepare')).toBe(false);
    expect(isCompileOnly('verify')).toBe(false);
    for (const type of ['match', 'threshold', 'and_or', 'not', 'stopping', 'policy', 'action', 'custom'] as const) {
      expect(isCompileOnly(type)).toBe(true);
    }
  });
});

describe('watch decompile', () => {
  it('makes a match, a threshold per numeric param, and an any/all block when multi-source', () => {
    const blocks = blocksForNode(node('pg-watch-owe'));
    const types = blocks.map((block) => block.type);
    expect(types).toContain('match');
    const threshold = blocks.find((block) => block.type === 'threshold');
    expect(threshold?.editable).toEqual({ control: 'number', param: 'quietDays' });
    const anyAll = blocks.find((block) => block.type === 'and_or');
    expect(anyAll?.editable).toEqual({ control: 'sources' });
  });

  it('makes only a match for a single-source, param-free watch', () => {
    const blocks = blocksForNode(node('pg-watch-appeal'));
    expect(blocks.map((block) => block.type)).toEqual(['match']);
  });

  it('reads the Clock as one of the manuscript watch sources (time is a fact source)', () => {
    const blocks = blocksForNode(node('pg-watch-book'));
    const anyAll = blocks.find((block) => block.type === 'and_or');
    expect(anyAll?.label).toContain('3 sources');
  });
});

describe('judgment decompile', () => {
  it('is one policy block editing the interruption class', () => {
    const blocks = blocksForNode(node('pg-judg-owe'));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('policy');
    expect(blocks[0].editable).toEqual({ control: 'judgmentClass' });
  });
});

describe('response decompile: typed steps, fork/merge, permission-grammar action', () => {
  it('renders the prepare/verify trunk, the then/else fork, and the terminal action (the merge)', () => {
    const blocks = blocksForNode(node('pg-resp-owe'));
    const terminal = blocks[blocks.length - 1];
    expect(blocks[0].type).toBe('prepare');
    expect(blocks[1].type).toBe('verify');
    expect(blocks.find((block) => block.branch === 'then')).toBeTruthy();
    expect(blocks.find((block) => block.branch === 'else')).toBeTruthy();
    expect(terminal.type).toBe('action');
    expect(terminal.id).toBe('pg-resp-owe-b-action');
    expect(terminal.editable).toEqual({ control: 'actionClass' });
  });

  it('paints the action rail by the permission grammar', () => {
    // owe: no grant -> asks each time (accent).
    expect(blocksForNode(node('pg-resp-owe')).at(-1)?.rail).toBe('var(--ij-accent)');
    // book: granted, in budget -> can act on its own (gold).
    expect(blocksForNode(node('pg-resp-book')).at(-1)?.rail).toBe('var(--ij-gold)');
    // subs: granted but over budget -> does not run (error).
    expect(blocksForNode(node('pg-resp-subs')).at(-1)?.rail).toBe('var(--ij-error)');
  });
});

describe('atomic kinds carry no blocks', () => {
  it('a stake, source, and assumption decompile to nothing (frontier honesty)', () => {
    expect(blocksForNode(node('pg-stake-appeal'))).toEqual([]);
    expect(blocksForNode(node('pg-source-email'))).toEqual([]);
    expect(blocksForNode(node('pg-assume-deadline'))).toEqual([]);
  });
});
