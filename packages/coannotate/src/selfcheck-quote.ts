// SOURCING: none; pure test logic (node:assert), no upstream component applies.
//
// Headless self-check for the pure quote resolver (HANDOFF-MARGIN-RECALL D1/D3).
// Run: `node --experimental-strip-types src/selfcheck-quote.ts` (Node >=22).
// These prove the re-anchor contract the whole overlay stands on: exact quotes
// resolve at confidence 1 (unchanged AND relocated passages), a small edit still
// resolves with a high-but-sub-1 confidence, and a vanished passage scores below
// any reasonable threshold; which is how D3 decides "orphan".

import assert from 'node:assert/strict';
import { levenshtein, locateOffset, matchQuote, similarity } from './index.ts';

// --- edit distance + similarity primitives ---
assert.equal(levenshtein('kitten', 'sitting'), 3);
assert.equal(levenshtein('abc', 'abc'), 0);
assert.equal(levenshtein('', 'abc'), 3);
assert.equal(similarity('abc', 'abc'), 1);
assert.equal(similarity('', ''), 1);
assert.ok(Math.abs(similarity('abcd', 'abce') - 0.75) < 1e-9);

// --- exact resolution: single occurrence, confidence 1, correct offsets ---
{
  const m = matchQuote('the cat sat on the mat', { exact: 'cat sat' });
  assert.deepEqual(m, { start: 4, end: 11, confidence: 1 });
}

// --- a RELOCATED passage still resolves exactly (D3: moved passage re-anchors) ---
{
  const m = matchQuote('prefix stuff the quote', { exact: 'the quote' });
  assert.ok(m && m.confidence === 1 && m.start === 13, 'moved passage re-anchors exactly');
}

// --- duplicate occurrences: suffix context disambiguates ---
{
  // "the" appears at 0 and 12; the suffix " dog" points at the second.
  const m = matchQuote('the fox and the dog', { exact: 'the', suffix: ' dog' });
  assert.equal(m?.start, 12, 'suffix context selects the trailing occurrence');
}
// --- duplicate occurrences: suffix context can select the FIRST ---
{
  const m = matchQuote('the dog and the fox', { exact: 'the', suffix: ' dog' });
  assert.equal(m?.start, 0, 'suffix context selects the leading occurrence');
}
// --- duplicate occurrences: position hint is the tiebreak ---
{
  const text = 'cat dog cat dog cat'; // "cat" at 0, 8, 16
  assert.equal(matchQuote(text, { exact: 'cat' }, { start: 16, end: 19 })?.start, 16);
  assert.equal(matchQuote(text, { exact: 'cat' }, { start: 0, end: 3 })?.start, 0);
}

// --- fuzzy: a small edit resolves with high-but-sub-1 confidence ---
{
  const m = matchQuote('the quikc brown fox', { exact: 'the quick brown fox' });
  assert.ok(m, 'a near-miss still returns a candidate');
  assert.ok(m.confidence > 0.8 && m.confidence < 1, `small edit is fuzzy (${m.confidence})`);
  assert.equal(m.start, 0);
}

// --- fuzzy: a vanished/replaced passage scores below any threshold → orphan ---
{
  const m = matchQuote('XXXXXXXXXXXXXXXXXXX', { exact: 'the quick brown fox' });
  assert.ok(m, 'fuzzy always returns a best candidate...');
  assert.ok(m.confidence < 0.3, `...but a gone passage scores low (${m.confidence}) → orphan`);
}

// --- nothing to match ---
assert.equal(matchQuote('', { exact: 'x' }), null, 'empty text yields null');
assert.equal(matchQuote('abc', { exact: '' }), null, 'empty quote yields null');

// --- locateOffset: seam and clamp behavior ---
assert.deepEqual(locateOffset([5, 5, 5], 0), { nodeIndex: 0, offset: 0 });
assert.deepEqual(locateOffset([5, 5, 5], 4), { nodeIndex: 0, offset: 4 });
assert.deepEqual(locateOffset([5, 5, 5], 5), { nodeIndex: 1, offset: 0 }, 'seam → start of next node');
assert.deepEqual(locateOffset([5, 5, 5], 12), { nodeIndex: 2, offset: 2 });
assert.deepEqual(locateOffset([5, 5, 5], 15), { nodeIndex: 2, offset: 5 }, 'total → end of last node');
assert.deepEqual(locateOffset([5, 5, 5], 999), { nodeIndex: 2, offset: 5 }, 'past total clamps');
assert.deepEqual(locateOffset([], 3), { nodeIndex: 0, offset: 0 }, 'empty run is safe');

console.log('coannotate quote selfcheck: all assertions passed');
