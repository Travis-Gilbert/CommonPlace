// Headless self-check for the DOM anchor resolver (D3), with a tiny fake DOM.
// Run: `node --experimental-strip-types src/selfcheck-dom.ts` (Node >=22).
// A real browser `Element`/`Document` satisfies the same `AnchorEl`/`AnchorRoot`
// interfaces, so passing this AND `tsc` gives confidence without jsdom.

import assert from 'node:assert/strict';
import {
  observeReanchor,
  parseSourceAttr,
  reanchor,
  readSourceAnchor,
  resolveAnchorRect,
  robustSelector,
  selectorAnchor,
} from './index.ts';
import type { AnchorEl, AnchorRoot, MutationObserverLike, Rect } from './index.ts';

type Attrs = Record<string, string>;

class FakeEl implements AnchorEl {
  tagName: string;
  id: string;
  attrs: Attrs;
  rect: Rect;
  parentElement: FakeEl | null;
  previousElementSibling: FakeEl | null;

  constructor(tag: string, opts: { id?: string; attrs?: Attrs; rect?: Rect } = {}) {
    this.tagName = tag.toUpperCase();
    this.id = opts.id ?? '';
    this.attrs = opts.attrs ?? {};
    this.rect = opts.rect ?? { x: 0, y: 0, width: 0, height: 0 };
    this.parentElement = null;
    this.previousElementSibling = null;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  getBoundingClientRect(): Rect {
    return this.rect;
  }

  closest(selectors: string): AnchorEl | null {
    const attr = selectors.match(/^\[([a-z-]+)\]$/);
    let cur: FakeEl | null = this;
    while (cur) {
      if (attr && cur.attrs[attr[1]] != null) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
}

class FakeRoot implements AnchorRoot {
  all: FakeEl[];
  bySelector: Record<string, FakeEl>;

  constructor(all: FakeEl[], bySelector: Record<string, FakeEl> = {}) {
    this.all = all;
    this.bySelector = bySelector;
  }

  querySelector(selectors: string): AnchorEl | null {
    return this.bySelector[selectors] ?? null;
  }

  querySelectorAll(selectors: string): ArrayLike<AnchorEl> {
    const attr = selectors.match(/^\[([a-z-]+)\]$/);
    if (attr) return this.all.filter((el) => el.attrs[attr[1]] != null);
    return [];
  }
}

// 1. parseSourceAttr.
assert.deepEqual(parseSourceAttr('src/App.tsx:42:9'), { path: 'src/App.tsx', line: 42, column: 9 });
assert.deepEqual(parseSourceAttr('a/b.tsx:7'), { path: 'a/b.tsx', line: 7 });
assert.equal(parseSourceAttr('no-line-here'), null);

// 2. readSourceAnchor: a child element inherits its nearest instrumented host.
const host = new FakeEl('div', { attrs: { 'data-cp-loc': 'src/App.tsx:42:9' } });
const child = new FakeEl('span');
child.parentElement = host;
const read = readSourceAnchor(child);
assert.ok(read, 'the source anchor resolves from the nearest data-cp-loc host');
assert.deepEqual(read.anchor, { kind: 'file_line', path: 'src/App.tsx', line: 42, column: 9 });
assert.equal(read.chip, 'src/App.tsx:42');
// A non-instrumented element yields nothing.
assert.equal(readSourceAnchor(new FakeEl('p')), null);

// 3. robustSelector: id > data-testid > nth-of-type path.
assert.equal(robustSelector(new FakeEl('div', { id: 'header' })), '#header');
<<<<<<< HEAD
assert.equal(robustSelector(new FakeEl('div', { id: '123' })), '#\\31 23');
assert.equal(robustSelector(new FakeEl('div', { id: '-123' })), '#-\\31 23');
=======
>>>>>>> origin/main
assert.equal(
  robustSelector(new FakeEl('button', { attrs: { 'data-testid': 'save' } })),
  '[data-testid="save"]',
);
// nth-of-type path: a <span> that is the 2nd span under a <div>.
const wrap = new FakeEl('div');
const span1 = new FakeEl('span');
const span2 = new FakeEl('span');
span1.parentElement = wrap;
span2.parentElement = wrap;
span2.previousElementSibling = span1;
assert.equal(robustSelector(span2), 'div > span:nth-of-type(2)');

// 4. selectorAnchor carries the selector + the current rect fallback.
const boxed = new FakeEl('div', { id: 'card', rect: { x: 10, y: 20, width: 100, height: 40 } });
const anch = selectorAnchor(boxed);
assert.deepEqual(anch, {
  kind: 'selector',
  selector: '#card',
  rect: { x: 10, y: 20, width: 100, height: 40 },
});

// 5. resolveAnchorRect for a file_line anchor finds the matching instrumented el.
const instrumented = new FakeEl('h1', {
  attrs: { 'data-cp-loc': 'src/App.tsx:42:9' },
  rect: { x: 0, y: 0, width: 200, height: 30 },
});
const fileRoot = new FakeRoot([instrumented]);
assert.deepEqual(
  resolveAnchorRect({ kind: 'file_line', path: 'src/App.tsx', line: 42 }, fileRoot),
  { x: 0, y: 0, width: 200, height: 30 },
);
// A file_line anchor with no match resolves to null.
assert.equal(resolveAnchorRect({ kind: 'file_line', path: 'x', line: 1 }, fileRoot), null);

// 6. resolveAnchorRect for a selector anchor: live element wins; stored rect is
//    the fallback when it has vanished (survives a reflow that removed it).
const live = new FakeEl('div', { id: 'live', rect: { x: 5, y: 5, width: 10, height: 10 } });
const selRoot = new FakeRoot([live], { '#live': live });
assert.deepEqual(resolveAnchorRect({ kind: 'selector', selector: '#live' }, selRoot), {
  x: 5,
  y: 5,
  width: 10,
  height: 10,
});
const emptyRoot = new FakeRoot([]);
assert.deepEqual(
  resolveAnchorRect(
    { kind: 'selector', selector: '#gone', rect: { x: 1, y: 2, width: 3, height: 4 } },
    emptyRoot,
  ),
  { x: 1, y: 2, width: 3, height: 4 },
  'a vanished selector falls back to its stored rect',
);

// 7. reanchor resolves a batch; a removed anchor comes back with rect: null.
const results = reanchor(
  [
    { kind: 'selector', selector: '#live' },
    { kind: 'selector', selector: '#missing' },
  ],
  selRoot,
);
assert.equal(results.length, 2);
assert.ok(results[0].rect, 'the present anchor re-resolves');
assert.equal(results[1].rect, null, 'the missing anchor re-resolves to null');

// 8. observeReanchor: initial emit + a mutation triggers a fresh re-anchor;
//    stop() disconnects.
// A holder keeps the type wide across the closure assignment (a bare `let`
// would be flow-narrowed to `null`).
const captured: { cb: (() => void) | null } = { cb: null };
let disconnected = false;
const makeObserver = (cb: () => void): MutationObserverLike => {
  captured.cb = cb;
  return {
    observe: () => {},
    disconnect: () => {
      disconnected = true;
    },
  };
};
let updates = 0;
const stop = observeReanchor(
  makeObserver,
  {},
  () => [{ kind: 'selector', selector: '#live' }],
  selRoot,
  () => {
    updates += 1;
  },
);
assert.equal(updates, 1, 'observeReanchor emits an initial resolution');
<<<<<<< HEAD
const observerCallback = captured.cb;
assert.ok(observerCallback, 'the observer callback is registered');
observerCallback();
=======
assert.ok(captured.cb, 'the observer callback is registered');
captured.cb();
>>>>>>> origin/main
assert.equal(updates, 2, 'a mutation triggers a re-anchor');
stop();
assert.equal(disconnected, true, 'stop() disconnects the observer');

console.log('coannotate DOM selfcheck: all assertions passed');
