// DOM anchor resolution for the co-annotation overlay (SPEC-PREVIEW-COANNOTATION D3).
//
// "Anchoring degrades honestly": file-and-line when we own the build (the dev
// preview stamps `data-cp-loc="file:line:column"` on the DOM), a robust selector
// plus a bounding-rect fallback when we do not, re-anchored on mutation. This
// module is the pointer/DOM half of the overlay -- pure logic over a NARROW DOM
// surface (`AnchorEl`/`AnchorRoot`), which a real browser `Element`/`Document`
// satisfies structurally, so it runs in the browser AND is testable with a small
// fake (no jsdom).

import type { Anchor, Rect } from './types.ts';

/** The build-time source attribute the dev plugin stamps (D3). */
export const SOURCE_ATTR = 'data-cp-loc';

/** The subset of `Element` this module depends on. A real DOM `Element` is
 * structurally assignable to this, so callers pass real elements. */
export interface AnchorEl {
  readonly tagName: string;
  readonly id: string;
  readonly parentElement: AnchorEl | null;
  readonly previousElementSibling: AnchorEl | null;
  getAttribute(name: string): string | null;
  closest(selectors: string): AnchorEl | null;
  getBoundingClientRect(): Rect;
}

/** The subset of `Document`/`Element` used as a query root. */
export interface AnchorRoot {
  querySelector(selectors: string): AnchorEl | null;
  querySelectorAll(selectors: string): ArrayLike<AnchorEl>;
}

/** A parsed `file:line:column` source location. */
export interface SourceLoc {
  path: string;
  line: number;
  column?: number;
}

/** Parse a `data-cp-loc` value (`"src/App.tsx:42:9"` or `"src/App.tsx:42"`).
 * Windows-style drive letters are not expected here (dev paths are POSIX), so we
 * split on the LAST one or two colon-delimited integers. */
export function parseSourceAttr(value: string): SourceLoc | null {
  const parts = value.split(':');
  if (parts.length < 2) return null;
  // Try `path:line:column` then `path:line`.
  const maybeCol = Number(parts[parts.length - 1]);
  const maybeLine = Number(parts[parts.length - 2]);
  if (Number.isInteger(maybeLine) && Number.isInteger(maybeCol) && parts.length >= 3) {
    return { path: parts.slice(0, -2).join(':'), line: maybeLine, column: maybeCol };
  }
  const line = Number(parts[parts.length - 1]);
  if (Number.isInteger(line)) {
    return { path: parts.slice(0, -1).join(':'), line };
  }
  return null;
}

/** Read the source anchor for the element under the pointer (D3): walk up to the
 * nearest `[data-cp-loc]` and return a `FileLine` anchor plus the component chip
 * label (`path:line`). `null` on a non-instrumented page. */
export function readSourceAnchor(el: AnchorEl): { anchor: Anchor; chip: string } | null {
  const host = el.closest(`[${SOURCE_ATTR}]`);
  const raw = host?.getAttribute(SOURCE_ATTR);
  if (!host || !raw) return null;
  const loc = parseSourceAttr(raw);
  if (!loc) return null;
  const anchor: Anchor = {
    kind: 'file_line',
    path: loc.path,
    line: loc.line,
    ...(loc.column != null ? { column: loc.column } : {}),
  };
  const chip = `${loc.path}:${loc.line}`;
  return { anchor, chip };
}

function nthOfType(el: AnchorEl): number {
  let n = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) n += 1;
    sib = sib.previousElementSibling;
  }
  return n;
}

/** Build a reasonably robust CSS selector for an element: prefer `#id`, then a
 * `data-testid`, else a `tag:nth-of-type(n)` path up to (but not including) the
 * `body`/root. Not globally unique in pathological DOMs, but stable across the
 * reflows a dev page produces. */
export function robustSelector(el: AnchorEl, root?: AnchorRoot): string {
  if (el.id) return `#${cssEscapeIdent(el.id)}`;
  const testid = el.getAttribute('data-testid');
  if (testid) return `[data-testid="${cssEscapeAttr(testid)}"]`;

  const parts: string[] = [];
  let cur: AnchorEl | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'body') {
    if (cur.id) {
      parts.unshift(`#${cssEscapeIdent(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const idx = nthOfType(cur);
    parts.unshift(idx > 1 ? `${tag}:nth-of-type(${idx})` : tag);
    if (root && (cur.parentElement === null || matchesRoot(cur.parentElement, root))) break;
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

// A structural check is impossible cross-interface, so this is a no-op hook the
// resolver does not depend on; kept for signature symmetry.
function matchesRoot(_el: AnchorEl, _root: AnchorRoot): boolean {
  return false;
}

/** A `Selector` anchor for an element, with its current bounding rect as the
 * fallback the overlay re-anchors from. */
export function selectorAnchor(el: AnchorEl, root?: AnchorRoot): Anchor {
  return { kind: 'selector', selector: robustSelector(el, root), rect: el.getBoundingClientRect() };
}

/** Resolve an anchor to the element currently matching it, or `null` if it has
 * vanished (removed from the DOM). Page anchors have no element. */
export function resolveAnchorEl(anchor: Anchor, root: AnchorRoot): AnchorEl | null {
  switch (anchor.kind) {
    case 'file_line': {
      const candidates = root.querySelectorAll(`[${SOURCE_ATTR}]`);
      for (let i = 0; i < candidates.length; i += 1) {
        const el = candidates[i];
        const loc = parseSourceAttr(el.getAttribute(SOURCE_ATTR) ?? '');
        if (loc && loc.path === anchor.path && loc.line === anchor.line) {
          return el;
        }
      }
      return null;
    }
    case 'selector':
      return safeQuery(root, anchor.selector);
    case 'page':
      return null;
  }
}

/** Resolve an anchor to its CURRENT viewport rect (for placing the pin). Falls
 * back to a `selector` anchor's stored `rect` when the element is gone, so a pin
 * still renders in roughly the right place after a reflow that removed it. */
export function resolveAnchorRect(anchor: Anchor, root: AnchorRoot): Rect | null {
  const el = resolveAnchorEl(anchor, root);
  if (el) return el.getBoundingClientRect();
  if (anchor.kind === 'selector' && anchor.rect) return anchor.rect;
  return null;
}

/** Re-anchor a set of anchors to their current rects (D3: "pins survive a reflow
 * via re-anchoring"). Returns one entry per input, `rect: null` when the anchor
 * can no longer be resolved (so the caller can fade a stale pin). */
export function reanchor(
  anchors: Anchor[],
  root: AnchorRoot,
): Array<{ anchor: Anchor; rect: Rect | null }> {
  return anchors.map((anchor) => ({ anchor, rect: resolveAnchorRect(anchor, root) }));
}

/** A MutationObserver-like: the real `MutationObserver` satisfies this. */
export interface MutationObserverLike {
  observe(target: unknown, options?: unknown): void;
  disconnect(): void;
}

/** Wire re-anchoring to DOM mutations: on any subtree mutation, re-resolve the
 * anchors and invoke `onUpdate`. The observer is injected so this is testable
 * headlessly; in the browser pass `new MutationObserver(cb)` and the document.
 * Returns a stop function. */
export function observeReanchor(
  make: (cb: () => void) => MutationObserverLike,
  target: unknown,
  getAnchors: () => Anchor[],
  root: AnchorRoot,
  onUpdate: (resolved: Array<{ anchor: Anchor; rect: Rect | null }>) => void,
): () => void {
  const observer = make(() => onUpdate(reanchor(getAnchors(), root)));
  observer.observe(target, { subtree: true, childList: true, attributes: true });
  // Emit an initial resolution so the caller starts placed.
  onUpdate(reanchor(getAnchors(), root));
  return () => observer.disconnect();
}

function safeQuery(root: AnchorRoot, selector: string): AnchorEl | null {
  try {
    return root.querySelector(selector);
  } catch {
    // An invalid/exotic selector must not throw the overlay.
    return null;
  }
}

function cssEscapeIdent(value: string): string {
  // Minimal identifier escaping: enough for the ids/classes dev pages emit.
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function cssEscapeAttr(value: string): string {
  return value.replace(/(["\\])/g, '\\$1');
}
