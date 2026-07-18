// SOURCING: none; headless self-check (node:assert) with a tiny fake Range.
// Run: `node --experimental-strip-types src/selfcheck-quote-dom.ts` (Node >=22).
// A real browser `Text`/`Range` satisfies the same `TextNodeLike`/`RangeLike`
// interfaces, so passing this AND `tsc` gives confidence without jsdom.

import assert from 'node:assert/strict';
import {
  collectTextRun,
  rectsForMatch,
  resolveTextRects,
} from './quote-dom.ts';
import type { RangeLike, Rect, TextNodeLike } from './index.ts';

/** A fake DOM text node: just its text. (Explicit field, not a constructor
 * parameter property; `node --experimental-strip-types` only erases types, it can't
 * transform the assignment a parameter property implies.) */
class FakeText implements TextNodeLike {
  readonly textContent: string;
  constructor(textContent: string) {
    this.textContent = textContent;
  }
}

/** A fake `Range` that records the boundary it was set to and returns canned rects,
 * so a test asserts BOTH that the right (node, offset) boundaries were chosen and
 * that zero-area rects are dropped. */
class FakeRange implements RangeLike {
  startNode: TextNodeLike | null = null;
  startOffset = -1;
  endNode: TextNodeLike | null = null;
  endOffset = -1;
  private readonly rects: Rect[];

  constructor(rects: Rect[]) {
    this.rects = rects;
  }

  setStart(node: TextNodeLike, offset: number): void {
    this.startNode = node;
    this.startOffset = offset;
  }

  setEnd(node: TextNodeLike, offset: number): void {
    this.endNode = node;
    this.endOffset = offset;
  }

  getClientRects(): ArrayLike<Rect> {
    return this.rects;
  }
}

// 1. collectTextRun flattens nodes to text + index-aligned lengths.
const run = collectTextRun([new FakeText('Hello '), new FakeText('world')]);
assert.equal(run.text, 'Hello world');
assert.deepEqual(run.lengths, [6, 5]);
assert.equal(run.nodes.length, 2);

// 2. rectsForMatch maps offsets onto the right node boundaries and drops zero-area
//    rects. Match 'world' = chars [6,11): start -> node 1 offset 0, end -> node 1
//    offset 5 (the seam resolves to the following node's start; the tail clamps to
//    the last node's end).
const lineRect: Rect = { x: 40, y: 10, width: 60, height: 16 };
const zeroRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
const fake = new FakeRange([zeroRect, lineRect]);
const rects = rectsForMatch(run, { start: 6, end: 11, confidence: 1 }, fake);
assert.deepEqual(fake.startNode, run.nodes[1], 'start boundary lands on the second node');
assert.equal(fake.startOffset, 0);
assert.deepEqual(fake.endNode, run.nodes[1], 'end boundary lands on the second node');
assert.equal(fake.endOffset, 5);
assert.deepEqual(rects, [lineRect], 'the zero-area rect is dropped, the line rect kept');

// 3. A multi-line match returns one rect per line, in order.
const multi = new FakeRange([
  { x: 40, y: 10, width: 60, height: 16 },
  { x: 0, y: 26, width: 30, height: 16 },
]);
const multiRects = rectsForMatch(collectTextRun([new FakeText('two line quote')]), { start: 0, end: 14, confidence: 1 }, multi);
assert.equal(multiRects.length, 2, 'a wrapped quote yields one rect per visual line');

// 4. resolveTextRects: exact quote -> confidence 1 + rects from the range.
const exact = resolveTextRects(
  [new FakeText('Hello '), new FakeText('world')],
  { exact: 'world' },
  undefined,
  () => new FakeRange([lineRect]),
);
assert.equal(exact.confidence, 1, 'an exact quote resolves at full confidence');
assert.deepEqual(exact.rects, [lineRect]);

// 5. A quote whose exact text is gone still resolves (fuzzy) but below full
//    confidence; the caller owns the orphan threshold, so this never returns null
//    for present text.
const fuzzy = resolveTextRects(
  [new FakeText('Hello world')],
  { exact: 'wrold' },
  undefined,
  () => new FakeRange([lineRect]),
);
assert.ok(fuzzy.confidence < 1, 'a fuzzy match carries sub-1 confidence');
assert.ok(fuzzy.confidence > 0, 'a close fuzzy match is still positive');

// 6. Empty inputs are safe: no nodes -> no rects, confidence 0 (nothing to tint).
const empty = resolveTextRects([], { exact: 'x' }, undefined, () => new FakeRange([lineRect]));
assert.deepEqual(empty.rects, []);
assert.equal(empty.confidence, 0);

// 7. rectsForMatch on an empty run never touches the range.
const untouched = new FakeRange([lineRect]);
assert.deepEqual(rectsForMatch(collectTextRun([]), { start: 0, end: 0, confidence: 1 }, untouched), []);
assert.equal(untouched.startOffset, -1, 'an empty run does not set a range boundary');

console.log('coannotate quote-dom selfcheck: all assertions passed');
