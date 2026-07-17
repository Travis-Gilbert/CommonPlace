// SOURCING: none; headless self-check (node:assert) for the pure D3 re-anchor policy.
// Run: `node --experimental-strip-types src/selfcheck-reanchor.ts` (Node >=22).

import assert from 'node:assert/strict';
import { reanchorText } from './reanchor.ts';

const QUOTE = { exact: 'the sculptor of Athens' };

// 1. Identical content hash: reuse the stored position exactly, no re-resolve.
{
  const out = reanchorText(
    { quote: QUOTE, position: { start: 40, end: 62 }, contentHash: 'blake3:aaa' },
    { text: 'irrelevant, the hash short-circuits', contentHash: 'blake3:aaa' },
  );
  assert.equal(out.status, 'unchanged');
  assert.deepEqual(out.status === 'unchanged' ? out.position : null, { start: 40, end: 62 });
  assert.equal(out.confidence, 1);
}

// 2. Content changed, the quote still present exactly at a shifted offset: moved.
{
  const text = 'A new preface. Then: the sculptor of Athens returns.';
  const out = reanchorText(
    { quote: QUOTE, position: { start: 4, end: 26 }, contentHash: 'blake3:old' },
    { text, contentHash: 'blake3:new' },
  );
  assert.equal(out.status, 'moved');
  if (out.status === 'moved') {
    assert.equal(text.slice(out.position.start, out.position.end), 'the sculptor of Athens');
    assert.equal(out.confidence, 1);
  }
}

// 3. Content changed, the quote is gone: orphan (never painted on the wrong text).
{
  const out = reanchorText(
    { quote: QUOTE, position: { start: 4, end: 26 }, contentHash: 'blake3:old' },
    { text: 'A completely different page about marine biology and tide pools.', contentHash: 'blake3:new' },
    { minConfidence: 0.6 },
  );
  assert.equal(out.status, 'orphan');
  assert.ok(out.confidence < 0.6);
}

// 4. Hash matches but no stored position: fall through to re-resolve rather than trust
//    a missing position.
{
  const text = 'Find the sculptor of Athens here.';
  const out = reanchorText(
    { quote: QUOTE, contentHash: 'blake3:same' },
    { text, contentHash: 'blake3:same' },
  );
  assert.equal(out.status, 'moved');
  if (out.status === 'moved') {
    assert.equal(text.slice(out.position.start, out.position.end), 'the sculptor of Athens');
  }
}

// 5. A near-miss that clears the threshold re-anchors (moved), not orphaned.
{
  const text = 'the sculptor of Athens'.replace('Athens', 'Athenz'); // one-char drift
  const out = reanchorText(
    { quote: QUOTE, position: { start: 0, end: 22 }, contentHash: 'blake3:old' },
    { text, contentHash: 'blake3:new' },
    { minConfidence: 0.5 },
  );
  assert.equal(out.status, 'moved');
  assert.ok(out.confidence >= 0.5 && out.confidence < 1);
}

console.log('coannotate reanchor selfcheck: all assertions passed');
