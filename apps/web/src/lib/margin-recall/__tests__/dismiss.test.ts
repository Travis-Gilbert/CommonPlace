import { describe, expect, it } from 'vitest';
import {
  dismissHighlight,
  EMPTY_DISMISS_STATE,
  isDismissed,
  resetDismissals,
} from '../dismiss';

const CANDIDATE = { id: 'item:war:40-61', tier: 'exact' as const, score: 1 };
const PAGE = 'blake3:abc';

describe('dismissHighlight (D6-4)', () => {
  it('hides the highlight and emits a page-scoped relevance signal', () => {
    const { state, signal } = dismissHighlight(EMPTY_DISMISS_STATE, CANDIDATE, PAGE);
    expect(isDismissed(state, CANDIDATE.id)).toBe(true);
    expect(signal).toEqual({
      kind: 'margin_recall.dismiss',
      id: 'item:war:40-61',
      tier: 'exact',
      page: 'blake3:abc',
      score: 1,
    });
  });

  it('does not double-count a re-dismiss', () => {
    const first = dismissHighlight(EMPTY_DISMISS_STATE, CANDIDATE, PAGE);
    const second = dismissHighlight(first.state, CANDIDATE, PAGE);
    expect(second.signal).toBeNull();
    expect(second.state).toBe(first.state);
  });

  it('keeps earlier dismissals when a second highlight is dismissed', () => {
    const first = dismissHighlight(EMPTY_DISMISS_STATE, CANDIDATE, PAGE);
    const second = dismissHighlight(
      first.state,
      { id: 'item:art:4-37', tier: 'semantic', score: 0.8 },
      PAGE,
    );
    expect(isDismissed(second.state, CANDIDATE.id)).toBe(true);
    expect(isDismissed(second.state, 'item:art:4-37')).toBe(true);
  });
});

describe('resetDismissals (D6-4)', () => {
  it('clears dismissals on navigation (dismissals are per-page)', () => {
    const dismissed = dismissHighlight(EMPTY_DISMISS_STATE, CANDIDATE, PAGE).state;
    const fresh = resetDismissals();
    expect(isDismissed(fresh, CANDIDATE.id)).toBe(false);
    expect(isDismissed(dismissed, CANDIDATE.id)).toBe(true);
  });
});
