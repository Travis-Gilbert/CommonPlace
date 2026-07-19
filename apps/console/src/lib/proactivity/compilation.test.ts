import { describe, expect, it } from 'vitest';
import { parseProactivityCompilation } from './compilation';

describe('proactivity compilation boundary', () => {
  it('accepts only the constrained candidate envelope', () => {
    expect(parseProactivityCompilation(JSON.stringify({
      candidates: [{
        kind: 'response',
        label: 'Ask before preparing an appeal draft.',
        actionClass: 'email.prepare_draft',
      }],
    }))).toEqual([{
      kind: 'response',
      label: 'Ask before preparing an appeal draft.',
      actionClass: 'email.prepare_draft',
    }]);
  });

  it('rejects tenant, grant, and generic patch fields from model output', () => {
    for (const output of [
      { candidates: [{ kind: 'watch', label: 'Watch appeal.', tenant: 'Travis-Gilbert' }] },
      { candidates: [{ kind: 'response', label: 'Prepare appeal.', grant: 'always' }] },
      { candidates: [{ kind: 'watch', label: 'Watch appeal.', patch: { enabled: false } }] },
    ]) {
      expect(() => parseProactivityCompilation(JSON.stringify(output))).toThrow();
    }
  });
});
