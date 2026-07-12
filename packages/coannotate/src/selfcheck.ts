// Runnable self-check for the coannotate core (no test framework, no DOM).
// Run: `node --experimental-strip-types src/selfcheck.ts` (Node >=22).
// Covers the parity-critical + non-trivial logic: anchor wire-shape parity with
// the Rust serde enum, cursor easing (no teleport, reaches target, monotonic),
// the headless cursor controller, and the annotation client's op-building +
// response mapping.

import assert from 'node:assert/strict';
import {
  AgentCursorController,
  anchorLabel,
  annotationFromGraphql,
  annotationsForTarget,
  autoResolveOnCommit,
  buildCreateAnnotation,
  buildFixThisRequest,
  createAnnotation,
  CursorGlide,
  easeInOutCubic,
  glideDurationFor,
  parseAnchor,
  touchesAnchor,
} from './index.ts';
import type { Anchor, Annotation, CommitTouch, GraphqlFetcher } from './index.ts';

// 1. Anchor wire-parity with Rust `Anchor` (serde tag = "kind", snake_case).
const fileAnchor: Anchor = { kind: 'file_line', path: 'src/App.tsx', line: 42, column: 9 };
const json = JSON.parse(JSON.stringify(fileAnchor));
assert.equal(json.kind, 'file_line', 'anchor serializes with the Rust "kind" tag');
assert.equal(json.path, 'src/App.tsx');
assert.equal(json.line, 42);
assert.deepEqual(parseAnchor(json), fileAnchor, 'anchor round-trips through parseAnchor');
assert.equal(parseAnchor({ kind: 'nope' }), null, 'a bad anchor is rejected');
assert.equal(anchorLabel(fileAnchor), 'src/App.tsx:42:9');
assert.equal(anchorLabel({ kind: 'page', url: 'https://x' }), 'https://x');

// 2. Easing: bounded, starts AT the source (no teleport), reaches the target,
//    monotonic in between.
assert.equal(easeInOutCubic(0), 0);
assert.equal(easeInOutCubic(1), 1);
assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9);
const glide = new CursorGlide({ x: 0, y: 0 }, { x: 100, y: 0 }, 1000);
assert.deepEqual(glide.sample(0), { x: 0, y: 0 }, 'glide starts at the source (never teleports)');
assert.deepEqual(glide.sample(1000), { x: 100, y: 0 }, 'glide reaches the target');
const mid = glide.sample(500).x;
assert.ok(mid > 0 && mid < 100, 'glide is in-between at the midpoint');
assert.ok(glide.sample(250).x < glide.sample(750).x, 'glide is monotonic');
assert.ok(glideDurationFor({ x: 0, y: 0 }, { x: 0, y: 0 }) >= 180, 'duration has a floor');
assert.ok(glideDurationFor({ x: 0, y: 0 }, { x: 100000, y: 0 }) <= 900, 'duration has a ceiling');

// 3. AgentCursorController glides from its current position to a rect center.
const cursor = new AgentCursorController({ x: 0, y: 0 });
cursor.glideTo({ x: 100, y: 100, width: 20, height: 20 }, 0); // center (110,110)
assert.deepEqual(cursor.sample(0), { x: 0, y: 0 }, 'controller does not teleport');
const settled = cursor.sample(10_000); // well past the glide duration
assert.ok(Math.abs(settled.x - 110) < 1e-6 && Math.abs(settled.y - 110) < 1e-6, 'controller reaches the rect center');
assert.equal(cursor.arrived(10_000), true);

// 4. Annotation client: op-building carries the anchor; a response maps to a
//    domain Annotation (with anchor + resolution).
const built = buildCreateAnnotation({ targetId: 'file_1', body: 'wraps', anchor: fileAnchor, authorKind: 'head' });
assert.match(built.query, /createAnnotation/);
const input = (built.variables as { input: Record<string, unknown> }).input;
assert.equal(input.targetId, 'file_1');
assert.deepEqual(input.anchor, fileAnchor, 'the op carries the wire-parity anchor');
assert.equal(input.authorKind, 'head');

const node = {
  id: 'c1',
  targetId: 'file_1',
  author: 'head:claude',
  authorKind: 'head',
  anchor: fileAnchor,
  body: 'wraps',
  resolved: true,
  resolution: { by: 'head:claude', receipt: 'commit:abc' },
  createdAtMs: 5,
};
const mapped = annotationFromGraphql(node);
assert.ok(mapped, 'a well-formed node maps');
assert.equal(mapped.id, 'c1');
assert.equal(mapped.authorKind, 'head');
assert.deepEqual(mapped.anchor, fileAnchor);
assert.equal(mapped.resolved, true);
assert.deepEqual(mapped.resolution, { by: 'head:claude', receipt: 'commit:abc' });

// 5. Client over a fake fetcher (no network): list + create round-trip.
const listFetch: GraphqlFetcher = async () => ({ annotationsForTarget: [node] });
const list = await annotationsForTarget(listFetch, 'file_1');
assert.equal(list.length, 1);
assert.equal(list[0].id, 'c1');

const echoFetch: GraphqlFetcher = async (_query, vars) => {
  const inp = (vars as { input: Record<string, unknown> }).input;
  return {
    createAnnotation: {
      id: 'new',
      body: inp.body,
      anchor: inp.anchor,
      authorKind: inp.authorKind,
      resolved: false,
      createdAtMs: 1,
    },
  };
};
const created = await createAnnotation(echoFetch, { targetId: 't', body: 'hi', anchor: fileAnchor, authorKind: 'user' });
assert.equal(created?.body, 'hi');
assert.deepEqual(created?.anchor, fileAnchor);

// 6. Annotate-to-patch loop (D6): Fix-this payload assembly + commit auto-resolve.
const ann: Annotation = {
  id: 'a1',
  targetId: 'file_1',
  author: 'user:travis',
  authorKind: 'user',
  anchor: { kind: 'file_line', path: 'src/Card.tsx', line: 42, column: 4 },
  body: 'this card is misaligned',
  resolved: false,
  createdAtMs: 1,
};
// Replies arrive newest-first (as annotations_for returns them); the payload is chronological.
const reply: Annotation = {
  id: 'r1',
  author: 'head:claude',
  authorKind: 'head',
  body: 'on it',
  resolved: false,
  createdAtMs: 2,
};
const fix = buildFixThisRequest(ann, [reply], 'blob:crop-1');
assert.equal(fix.annotationId, 'a1');
assert.deepEqual(fix.anchor, ann.anchor);
assert.equal(fix.anchorLabel, 'src/Card.tsx:42:4');
assert.equal(fix.thread, 'user:travis: this card is misaligned\nhead:claude: on it');
assert.equal(fix.screenshotRef, 'blob:crop-1');

const commit: CommitTouch = {
  hash: 'abc123',
  ranges: [{ path: 'src/Card.tsx', startLine: 40, endLine: 45 }],
};
assert.equal(touchesAnchor(fix.anchor, commit), true, 'a commit touching the anchored line matches');
assert.equal(touchesAnchor({ kind: 'file_line', path: 'src/Card.tsx', line: 99 }, commit), false);
assert.equal(touchesAnchor({ kind: 'file_line', path: 'other.tsx', line: 42 }, commit), false);
assert.equal(touchesAnchor({ kind: 'selector', selector: '.x' }, commit), false, 'a selector anchor is not commit-touchable');

const auto = autoResolveOnCommit(ann, commit);
assert.equal(auto.resolved, true);
assert.deepEqual(auto.resolution, { by: 'commit', receipt: 'abc123' }, 'auto-resolves with a commit receipt');
const untouched = autoResolveOnCommit(ann, {
  hash: 'z',
  ranges: [{ path: 'other.tsx', startLine: 1, endLine: 2 }],
});
assert.equal(untouched.resolved, false, 'an unrelated commit does not resolve the pin');

console.log('coannotate selfcheck: all assertions passed');
