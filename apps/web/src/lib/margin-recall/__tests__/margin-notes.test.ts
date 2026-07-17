import { describe, expect, it } from 'vitest';
import {
  collapsedLine,
  layoutMarginNotes,
  type MarginNote,
} from '../margin-notes';

function note(id: string, anchorY: number, explanation = 'Related to your note "X".'): MarginNote {
  return { id, anchorY, explanation, tier: 'semantic' };
}

const BOX = { top: 0, height: 400 };
const OPTS = { marginWidth: 300, noteHeight: 64, gap: 8 };

describe('layoutMarginNotes mode (D5-1)', () => {
  it('renders notes when the margin is wide enough', () => {
    const layout = layoutMarginNotes([note('a', 10)], BOX, { ...OPTS, marginWidth: 260 });
    expect(layout.mode).toBe('notes');
  });

  it('collapses to chips when the margin is too narrow', () => {
    const layout = layoutMarginNotes([note('a', 10)], BOX, { ...OPTS, marginWidth: 120 });
    expect(layout.mode).toBe('chips');
    // Placement still resolves; only rendering changes.
    expect(layout.placements).toHaveLength(1);
  });
});

describe('layoutMarginNotes placement (D5-1)', () => {
  it('anchors a note to its highlight when there is room', () => {
    const layout = layoutMarginNotes([note('a', 120)], BOX, OPTS);
    expect(layout.placements[0].y).toBe(120);
  });

  it('orders by document position and pushes colliding notes down', () => {
    // Two notes whose anchors are 20px apart cannot both sit at their anchor with a
    // 64px height; the second stacks below the first.
    const layout = layoutMarginNotes([note('b', 30), note('a', 10)], BOX, OPTS);
    expect(layout.placements.map((p) => p.id)).toEqual(['a', 'b']);
    expect(layout.placements[0].y).toBe(10);
    // Pushed to first.y + noteHeight + gap = 10 + 64 + 8 = 82.
    expect(layout.placements[1].y).toBe(82);
    expect(layout.placements[1].y).toBeGreaterThan(layout.placements[1].note.anchorY);
  });

  it('lets a note far below sit at its own anchor (alignment across scroll)', () => {
    const layout = layoutMarginNotes([note('a', 10), note('b', 300)], BOX, OPTS);
    expect(layout.placements[1].y).toBe(300);
  });
});

describe('layoutMarginNotes overflow (D5-4)', () => {
  it('spills notes past the margin bottom into a doc-ordered overflow list', () => {
    // A short box that fits ~2 notes; the rest overflow, ordered by position.
    const shortBox = { top: 0, height: 150 };
    const notes = [note('a', 0), note('b', 0), note('c', 0), note('d', 0)];
    const layout = layoutMarginNotes(notes, shortBox, OPTS);
    // 0..64 fits, 72..136 fits, 144..208 exceeds 150 -> overflow.
    expect(layout.placements.map((p) => p.id)).toEqual(['a', 'b']);
    expect(layout.overflow.map((n) => n.id)).toEqual(['c', 'd']);
  });

  it('keeps overflow in document position order', () => {
    // A box that fits one note; the earlier-positioned note takes it, the later one
    // stacks past the bottom and overflows.
    const shortBox = { top: 0, height: 100 };
    const layout = layoutMarginNotes([note('late', 50), note('early', 10)], shortBox, OPTS);
    expect(layout.placements[0].id).toBe('early');
    expect(layout.overflow.map((n) => n.id)).toEqual(['late']);
  });
});

describe('collapsedLine (D5-1)', () => {
  it('returns the first sentence as one line', () => {
    const line = collapsedLine(note('a', 0, 'Connects to Athens. More detail follows here.'));
    expect(line).toBe('Connects to Athens.');
  });

  it('truncates a long single line with an ellipsis', () => {
    const long = 'x'.repeat(200);
    const line = collapsedLine(note('a', 0, long), 20);
    expect(line.length).toBeLessThanOrEqual(20);
    expect(line.endsWith('…')).toBe(true);
  });
});
