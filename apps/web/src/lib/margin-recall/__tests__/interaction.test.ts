import { describe, expect, it } from 'vitest';
import {
  highlightInteraction,
  IDLE_INTERACTION,
  noteMode,
  type HighlightInteractionState,
} from '../interaction';

const A = 'item:war:40-61';
const B = 'item:art:4-37';

function apply(
  state: HighlightInteractionState,
  ...events: Parameters<typeof highlightInteraction>[1][]
): HighlightInteractionState {
  return events.reduce(highlightInteraction, state);
}

describe('hover preview (D6-1)', () => {
  it('previews the hovered note and clears on leave', () => {
    const hovered = apply(IDLE_INTERACTION, { type: 'hover', id: A });
    expect(noteMode(hovered, A)).toBe('preview');
    const left = apply(hovered, { type: 'leave', id: A });
    expect(noteMode(left, A)).toBe('idle');
  });

  it('ignores a stale leave from a note the pointer already left', () => {
    const hovered = apply(IDLE_INTERACTION, { type: 'hover', id: A });
    // A late 'leave' for B must not blank A's preview.
    const still = apply(hovered, { type: 'leave', id: B });
    expect(still).toBe(hovered);
    expect(noteMode(still, A)).toBe('preview');
  });

  it('moves the preview when another note is hovered', () => {
    const moved = apply(IDLE_INTERACTION, { type: 'hover', id: A }, { type: 'hover', id: B });
    expect(noteMode(moved, A)).toBe('idle');
    expect(noteMode(moved, B)).toBe('preview');
  });
});

describe('select to the full connection (D6-2)', () => {
  it('expands on click or tap and collapses on a second one', () => {
    const open = apply(IDLE_INTERACTION, { type: 'select', id: A });
    expect(noteMode(open, A)).toBe('expanded');
    const closed = apply(open, { type: 'select', id: A });
    expect(noteMode(closed, A)).toBe('idle');
  });

  it('expanded outranks preview on the same note', () => {
    const both = apply(IDLE_INTERACTION, { type: 'hover', id: A }, { type: 'select', id: A });
    expect(noteMode(both, A)).toBe('expanded');
  });

  it('hovering another note never closes the expanded one', () => {
    const state = apply(IDLE_INTERACTION, { type: 'select', id: A }, { type: 'hover', id: B });
    expect(noteMode(state, A)).toBe('expanded');
    expect(noteMode(state, B)).toBe('preview');
  });

  it('selecting a second note moves the expansion', () => {
    const state = apply(IDLE_INTERACTION, { type: 'select', id: A }, { type: 'select', id: B });
    expect(noteMode(state, A)).toBe('idle');
    expect(noteMode(state, B)).toBe('expanded');
  });

  it('collapse closes the panel', () => {
    const state = apply(IDLE_INTERACTION, { type: 'select', id: A }, { type: 'collapse' });
    expect(noteMode(state, A)).toBe('idle');
    expect(state.expanded).toBeNull();
  });
});
