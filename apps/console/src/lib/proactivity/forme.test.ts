// PG5 acceptance: intent compiles into the correct node kinds and renders the
// compilation before anything goes live; honest failure names what it could not
// resolve; compile never invents an EffectContract (the AK2 boundary), so an
// action with no contract fails rather than granting itself capability.

import { describe, expect, it } from 'vitest';
import { seedStandingStructure } from './fixtures';
import { compileIntent, type IntentContext } from './forme';
import type { SourceNode } from './model';

function context(overrides: Partial<IntentContext> = {}): IntentContext {
  const structure = seedStandingStructure();
  return {
    sources: structure.nodes.filter((node): node is SourceNode => node.kind === 'source'),
    contracts: structure.effectContracts,
    idPrefix: 'authored-1',
    ...overrides,
  };
}

describe('compileIntent', () => {
  it('compiles an open-loop intent into an authored watch, judgment, and response (PG5)', () => {
    const result = compileIntent('tell me when anyone I owe work to goes quiet', context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.candidates.map((candidate) => candidate.kind).sort();
    expect(kinds).toEqual(['judgment', 'response', 'watch']);
    expect(result.candidates.every((candidate) => 'author' in candidate && candidate.author === 'human')).toBe(true);
    const watch = result.candidates.find((candidate) => candidate.kind === 'watch');
    expect(watch?.kind === 'watch' && watch.subKind).toBe('authored');
    expect(watch?.kind === 'watch' && watch.queryFamily).toBe('open_loops');
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('compiles a help intent into a stake and its derived program (PG5)', () => {
    const result = compileIntent('help with the insurance appeal', context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.candidates.map((candidate) => candidate.kind).sort();
    expect(kinds).toEqual(['judgment', 'response', 'stake', 'watch']);
    const stake = result.candidates.find((candidate) => candidate.kind === 'stake');
    expect(stake?.kind === 'stake' && stake.author).toBe('human');
  });

  it('refuses an action it has no effect contract for, never inventing one (AK2 boundary)', () => {
    const result = compileIntent('pay my invoice automatically every month', context());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/effect contract/i);
    expect(result.reason).toMatch(/will not invent|no effect contract/i);
  });

  it('fails honestly on an intent it cannot resolve, never a silent partial (PG5)', () => {
    const result = compileIntent('qwertyuiop asdfghjkl', context());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/could not resolve/i);
  });

  it('refuses when there are no connected sources', () => {
    const result = compileIntent('tell me when the editor goes quiet', context({ sources: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no connected sources/i);
  });

  it('refuses an open-loop intent when the draft_nudge contract is missing', () => {
    const structure = seedStandingStructure();
    const withoutNudge = structure.effectContracts.filter((contract) => contract.actionClass !== 'draft_nudge');
    const result = compileIntent('tell me when the contractor goes quiet', context({ contracts: withoutNudge }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/draft_nudge/);
  });

  it('compiles a recurring-charge intent instead of refusing on the noun "charge" (PG5)', () => {
    const result = compileIntent('notify me when a recurring charge appears', context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const watch = result.candidates.find((candidate) => candidate.kind === 'watch');
    expect(watch?.kind === 'watch' && watch.queryFamily).toBe('recurring_charges');
  });

  it('compiles a help intent whose topic contains "book" instead of refusing on the noun (PG5)', () => {
    const result = compileIntent('help with my book', context());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.some((candidate) => candidate.kind === 'stake')).toBe(true);
  });
});
