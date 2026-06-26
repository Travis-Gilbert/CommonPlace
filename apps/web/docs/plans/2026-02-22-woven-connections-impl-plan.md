# Woven Connections Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Replace the self-conscious footer ConnectionMap with three woven surfaces: inline callouts at paragraph mentions, enhanced margin dots as fallback, and thread lines between cards on listing pages.

**Architecture:** The connection engine (`connectionEngine.ts`) gains a `mentionFound` boolean on `PositionedConnection` and a new `computeThreadPairs()` function. A new `injectConnectionCallouts()` in `content.ts` injects HTML at build time (same pattern as `injectAnnotations()`). `ConnectionDots` evolves to show only fallback connections with a hover card. A new `ThreadLines` Client Component draws rough.js arcs between connected cards on listing pages and the homepage.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, rough.js, Tailwind CSS v4

**Design doc:** `docs/plans/2026-02-22-woven-connections-design.md`

---

### Task 1: Add `mentionFound` to engine and update `positionConnections()`

**Files:**
- Modify: `src/lib/connectionEngine.ts` (lines 22-25, 195-203)

**Step 1: Update the `PositionedConnection` interface**

In `src/lib/connectionEngine.ts`, change the interface at line 22:

```ts
export interface PositionedConnection {
  connection: Connection;
  paragraphIndex: number;
  mentionFound: boolean;
}
```

Note: `paragraphIndex` changes from `number | null` to `number` because we always provide `FALLBACK_PARAGRAPH` when no mention is found.

**Step 2: Update `positionConnections()` to set `mentionFound`**

Replace the function at line 195:

```ts
export function positionConnections(
  connections: Connection[],
  html: string,
): PositionedConnection[] {
  return connections.map((connection) => {
    const rawIndex = findMentionIndex(connection, html);
    return {
      connection,
      paragraphIndex: rawIndex ?? FALLBACK_PARAGRAPH,
      mentionFound: rawIndex !== null,
    };
  });
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Existing consumers (`ArticleBody`, `ConnectionDots`) still work because `paragraphIndex` is always a number now (no null). The `ConnectionDots` filter on line 38 (`c.paragraphIndex !== null`) still passes for all entries.

**Step 4: Commit**

```bash
git add src/lib/connectionEngine.ts
git commit -m "feat(connections): add mentionFound to PositionedConnection"
```

---

### Task 2: Add `injectConnectionCallouts()` to content.ts

**Files:**
- Modify: `src/lib/content.ts` (add after `injectAnnotations` function, around line 247)

**Step 1: Add the URL helper and injection function**

Add this after the closing brace of `injectAnnotations()` (after line 247):

```ts
// ─────────────────────────────────────────────────
// Connection callouts (inline, build-time)
// ─────────────────────────────────────────────────

/** Map connection type to its URL prefix */
const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

/** Map connection type to its display label */
const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

/**
 * Inject inline connection callout blocks after paragraphs that mention
 * connected content. Only processes connections where `mentionFound` is true.
 *
 * Follows the same `</p>` counting pattern as `injectAnnotations()`.
 * Must be called AFTER `injectAnnotations()` to avoid shifting paragraph indices.
 */
export function injectConnectionCallouts(
  html: string,
  connections: import('./connectionEngine').PositionedConnection[],
): string {
  // Only process connections with a real mention
  const mentionConnections = connections.filter((c) => c.mentionFound);
  if (mentionConnections.length === 0) return html;

  // Build a map of paragraph index to connections (sorted by weight)
  const WEIGHT_ORDER: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
  const byParagraph = new Map<number, typeof mentionConnections>();

  for (const pc of mentionConnections) {
    const group = byParagraph.get(pc.paragraphIndex) || [];
    group.push(pc);
    byParagraph.set(pc.paragraphIndex, group);
  }

  // Sort each group by weight (heavy first)
  for (const group of byParagraph.values()) {
    group.sort(
      (a, b) =>
        (WEIGHT_ORDER[a.connection.weight] ?? 2) -
        (WEIGHT_ORDER[b.connection.weight] ?? 2),
    );
  }

  let paragraphIndex = 0;

  return html.replace(/<\/p>/gi, (match) => {
    paragraphIndex++;
    const group = byParagraph.get(paragraphIndex);
    if (!group) return match;

    let injected = match;
    for (const pc of group) {
      const c = pc.connection;
      const href = `${TYPE_URL_PREFIX[c.type] ?? ''}/${c.slug}`;
      const label = TYPE_LABEL[c.type] ?? c.type;

      injected += `<aside class="connection-callout" data-connection-type="${c.type}" data-connection-color="${c.color}"><a href="${escapeAttr(href)}" class="connection-callout-link"><span class="connection-callout-type">${escapeAttr(label)}</span><span class="connection-callout-title">${escapeAttr(c.title)}</span></a></aside>`;
    }
    return injected;
  });
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. The function exists but is not called yet.

**Step 3: Commit**

```bash
git add src/lib/content.ts
git commit -m "feat(connections): add injectConnectionCallouts for inline callouts"
```

---

### Task 3: Add `.connection-callout` CSS styles

**Files:**
- Modify: `src/styles/global.css` (add near the end, before any dark mode section)

**Step 1: Add the callout styles**

Find the end of the existing content in `global.css` and append these styles. Look for the last substantial rule block and add after it:

```css
/* ─────────────────────────────────────────────────
   Connection Callouts (inline, build-time injected)
   ───────────────────────────────────────────────── */

.connection-callout {
  display: block;
  margin: 0.75rem 0 0.75rem 1rem;
  padding: 0.5rem 0.75rem;
  border-left: 2px solid var(--callout-color, var(--color-terracotta));
  border-radius: 0 4px 4px 0;
  transition: border-width 200ms ease, background-color 200ms ease;
}

.connection-callout:hover {
  border-left-width: 3px;
  background-color: color-mix(in srgb, var(--callout-color, var(--color-terracotta)) 3%, transparent);
}

.connection-callout[data-connection-type="essay"] {
  --callout-color: #B45A2D;
}

.connection-callout[data-connection-type="field-note"] {
  --callout-color: #2D5F6B;
}

.connection-callout[data-connection-type="shelf"] {
  --callout-color: #C49A4A;
}

.connection-callout-link {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  text-decoration: none;
  color: inherit;
}

.connection-callout-type {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--callout-color, var(--color-terracotta));
  opacity: 0.7;
}

.connection-callout-title {
  font-family: var(--font-annotation);
  font-size: 15px;
  color: var(--callout-color, var(--color-terracotta));
  line-height: 1.3;
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Styles exist but no HTML uses them yet.

**Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(connections): add connection-callout CSS styles"
```

---

### Task 4: Wire inline callouts into essay detail page

**Files:**
- Modify: `src/app/essays/[slug]/page.tsx` (lines 6, 18-21, 47-48, 120-121, 166-172, 254-263, 288)

This task removes ConnectionMap and ConnectionContext, and wires up `injectConnectionCallouts`.

**Step 1: Update imports**

At line 6, add `injectConnectionCallouts` to the content import:

```ts
import { getCollection, getEntry, renderMarkdown, injectAnnotations, injectConnectionCallouts, estimateReadingTime } from '@/lib/content';
```

Remove lines 20-21 (ConnectionProvider and ConnectionMap imports):

```ts
// DELETE these two lines:
import { ConnectionProvider } from '@/components/ConnectionContext';
import ConnectionMap from '@/components/ConnectionMap';
```

**Step 2: Inject callouts into the HTML pipeline**

After line 48 (`const html = injectAnnotations(...)`) and the `positionConnections` call (line 118), add the callout injection. The pipeline becomes:

```ts
const rawHtml = await renderMarkdown(entry.body);
const annotatedHtml = injectAnnotations(rawHtml, entry.data.annotations ?? []);

// Connection engine
const allContent: AllContent = {
  essays: getCollection<Essay>('essays').filter((e) => !e.data.draft),
  fieldNotes: allFieldNotes,
  shelf: allShelf,
};
const engineConnections = computeConnections(entry, allContent);
const positionedConnections = positionConnections(engineConnections, annotatedHtml);

// Inject inline callouts for connections with text mentions
const html = injectConnectionCallouts(annotatedHtml, positionedConnections);

// Only pass fallback connections (no text mention) to margin dots
const fallbackConnections = positionedConnections.filter((c) => !c.mentionFound);
```

Note: The `html` variable that was previously set on line 48 is now set after callout injection. All downstream uses of `html` stay the same.

**Step 3: Remove ConnectionProvider wrapper and ConnectionMap from JSX**

Remove the `<ConnectionProvider>` wrapper (line 121 opening, line 288 closing).

Remove the ConnectionMap rendering block (lines 254-263):

```tsx
{/* DELETE this entire block: */}
{engineConnections.length > 0 && (
  <>
    <RoughLine />
    <ConnectionMap
      essayTitle={entry.data.title}
      connections={engineConnections}
    />
  </>
)}
```

**Step 4: Pass only fallback connections to ArticleBody**

Change the `positionedConnections` prop on `ArticleBody` (around line 171) from `positionedConnections` to `fallbackConnections`:

```tsx
<ArticleBody
  html={html}
  className="prose prose-essays mt-8"
  contentType="essays"
  articleSlug={slug}
  positionedConnections={fallbackConnections}
/>
```

**Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Visit `/essays/the-sidewalk-tax` in dev to verify inline callout appears (if the slug-word match found the mention) and that the footer map is gone.

**Step 6: Commit**

```bash
git add src/app/essays/[slug]/page.tsx
git commit -m "feat(connections): wire inline callouts, remove ConnectionMap from essay page"
```

---

### Task 5: Evolve ConnectionDots (remove context, add hover card, direct navigation)

**Files:**
- Modify: `src/components/ConnectionDots.tsx`

**Step 1: Rewrite ConnectionDots**

Replace the entire file content:

```tsx
'use client';

import { useState, useEffect, useCallback, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import type { PositionedConnection } from '@/lib/connectionEngine';

/** URL prefix per connection type */
const TYPE_URL: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

/** Display label per connection type */
const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

interface ConnectionDotsProps {
  connections: PositionedConnection[];
  proseRef: RefObject<HTMLDivElement | null>;
}

export default function ConnectionDots({
  connections,
  proseRef,
}: ConnectionDotsProps) {
  const router = useRouter();
  const [offsets, setOffsets] = useState<Map<number, number>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const measure = useCallback(() => {
    if (!proseRef.current) return;
    setOffsets(measureParagraphOffsets(proseRef.current));
  }, [proseRef]);

  useEffect(() => {
    const container = proseRef.current;
    if (!container) return;

    document.fonts.ready.then(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [measure]);

  // Only render fallback connections (mentionFound === false)
  const fallback = connections.filter((c) => !c.mentionFound);
  if (fallback.length === 0) return null;

  // Group by paragraph index for stacking
  const byParagraph = new Map<number, PositionedConnection[]>();
  for (const pc of fallback) {
    const group = byParagraph.get(pc.paragraphIndex) || [];
    group.push(pc);
    byParagraph.set(pc.paragraphIndex, group);
  }

  function handleClick(pc: PositionedConnection) {
    const prefix = TYPE_URL[pc.connection.type] ?? '';
    router.push(`${prefix}/${pc.connection.slug}`);
  }

  return (
    <div
      className="hidden xl:block absolute pointer-events-none"
      style={{
        top: 0,
        right: '100%',
        width: 48,
        height: '100%',
      }}
    >
      {Array.from(byParagraph.entries()).map(([paraIdx, group]) => {
        const yOffset = offsets.get(paraIdx);
        if (yOffset === undefined) return null;

        return group.map((pc, i) => {
          const isHovered = hoveredId === pc.connection.id;

          return (
            <div
              key={pc.connection.id}
              className="absolute pointer-events-auto"
              style={{ top: yOffset + i * 12, right: 16 }}
              onMouseEnter={() => setHoveredId(pc.connection.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(pc.connection.id)}
              onBlur={() => setHoveredId(null)}
            >
              <button
                className="transition-all duration-200"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: pc.connection.color,
                  opacity: 0.7,
                  transform: isHovered ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: isHovered
                    ? `0 0 0 2px ${pc.connection.color}40`
                    : 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
                onClick={() => handleClick(pc)}
                aria-label={`Connected: ${pc.connection.title}`}
              />

              {/* Hover card */}
              <div
                className="absolute transition-all duration-200 pointer-events-none"
                style={{
                  top: -4,
                  left: 16,
                  width: 200,
                  maxWidth: 200,
                  padding: isHovered ? '6px 8px' : '0 8px',
                  borderLeft: `2px solid ${pc.connection.color}`,
                  backgroundColor: isHovered ? 'var(--color-paper)' : 'transparent',
                  boxShadow: isHovered
                    ? '0 2px 8px rgba(42, 36, 32, 0.12)'
                    : 'none',
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                  overflow: 'hidden',
                  maxHeight: isHovered ? 80 : 0,
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <span
                  className="block font-mono uppercase tracking-[0.08em]"
                  style={{
                    fontSize: 9,
                    color: pc.connection.color,
                    opacity: 0.7,
                  }}
                >
                  {TYPE_LABEL[pc.connection.type] ?? pc.connection.type}
                </span>
                <span
                  className="block leading-tight mt-0.5"
                  style={{
                    fontFamily: 'var(--font-annotation)',
                    fontSize: 14,
                    color: pc.connection.color,
                  }}
                >
                  {pc.connection.title}
                </span>
              </div>
            </div>
          );
        });
      })}
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. The component no longer imports `ConnectionContext`.

**Step 3: Commit**

```bash
git add src/components/ConnectionDots.tsx
git commit -m "feat(connections): evolve ConnectionDots with hover card and direct navigation"
```

---

### Task 6: Delete ConnectionMap and ConnectionContext

**Files:**
- Delete: `src/components/ConnectionMap.tsx`
- Delete: `src/components/ConnectionContext.tsx`

**Step 1: Delete the files**

```bash
rm src/components/ConnectionMap.tsx src/components/ConnectionContext.tsx
```

**Step 2: Verify no remaining imports**

Run: `grep -r "ConnectionMap\|ConnectionContext" src/ --include="*.tsx" --include="*.ts"`
Expected: No results (all imports were removed in Tasks 4 and 5).

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no missing module errors.

**Step 4: Commit**

```bash
git add -u src/components/ConnectionMap.tsx src/components/ConnectionContext.tsx
git commit -m "chore(connections): delete ConnectionMap and ConnectionContext"
```

---

### Task 7: Add `computeThreadPairs()` to engine

**Files:**
- Modify: `src/lib/connectionEngine.ts` (add at the end, after `positionConnections`)

**Step 1: Add the ThreadPair type and function**

Append to the end of `connectionEngine.ts`:

```ts
// ─────────────────────────────────────────────────
// Thread pairs (for listing page thread lines)
// ─────────────────────────────────────────────────

export interface ThreadPair {
  fromSlug: string;
  toSlug: string;
  type: ConnectionType;
  color: string;
  weight: ConnectionWeight;
}

/**
 * Compute unique thread pairs across all content for listing page arcs.
 * Deduplicates bidirectional relationships (A→B and B→A become one pair).
 * Limited to `maxPairs` to prevent visual noise.
 */
export function computeThreadPairs(
  content: AllContent,
  maxPairs = 8,
): ThreadPair[] {
  const seen = new Set<string>();
  const pairs: ThreadPair[] = [];

  // Essay related (bidirectional)
  for (const essay of content.essays) {
    if (essay.data.draft) continue;
    for (const relSlug of essay.data.related) {
      if (relSlug === essay.slug) continue;
      const target = content.essays.find((e) => e.slug === relSlug && !e.data.draft);
      if (!target) continue;

      const key = [essay.slug, relSlug].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({
        fromSlug: essay.slug,
        toSlug: relSlug,
        type: 'essay',
        color: TYPE_COLOR.essay,
        weight: TYPE_WEIGHT.essay,
      });
    }
  }

  // Field note connectedTo (unidirectional: note → essay)
  for (const note of content.fieldNotes) {
    if (note.data.draft || !note.data.connectedTo) continue;
    const target = content.essays.find(
      (e) => e.slug === note.data.connectedTo && !e.data.draft,
    );
    if (!target) continue;

    const key = [note.slug, note.data.connectedTo].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({
      fromSlug: note.slug,
      toSlug: note.data.connectedTo,
      type: 'field-note',
      color: TYPE_COLOR['field-note'],
      weight: TYPE_WEIGHT['field-note'],
    });
  }

  // Shelf connectedEssay (unidirectional: shelf → essay)
  for (const entry of content.shelf) {
    if (!entry.data.connectedEssay) continue;
    const target = content.essays.find(
      (e) => e.slug === entry.data.connectedEssay && !e.data.draft,
    );
    if (!target) continue;

    const key = [entry.slug, entry.data.connectedEssay].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({
      fromSlug: entry.slug,
      toSlug: entry.data.connectedEssay,
      type: 'shelf',
      color: TYPE_COLOR.shelf,
      weight: TYPE_WEIGHT.shelf,
    });
  }

  // Sort by weight (heavy first) and limit
  const WEIGHT_SORT: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
  pairs.sort((a, b) => (WEIGHT_SORT[a.weight] ?? 2) - (WEIGHT_SORT[b.weight] ?? 2));

  return pairs.slice(0, maxPairs);
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Function exists but is not called yet.

**Step 3: Commit**

```bash
git add src/lib/connectionEngine.ts
git commit -m "feat(connections): add computeThreadPairs for listing page arcs"
```

---

### Task 8: Create ThreadLines component

**Files:**
- Create: `src/components/ThreadLines.tsx`

**Step 1: Create the component**

Create `src/components/ThreadLines.tsx`:

```tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import rough from 'roughjs';
import type { ThreadPair } from '@/lib/connectionEngine';
import { WEIGHT_STROKE } from '@/lib/connectionEngine';

interface ThreadLinesProps {
  pairs: ThreadPair[];
  /** CSS selector for the container that holds the cards with data-slug attributes */
  containerSelector?: string;
}

/** Debounce delay for ResizeObserver recalculation */
const RESIZE_DEBOUNCE_MS = 250;

interface ArcEndpoint {
  x: number;
  y: number;
}

interface ResolvedArc {
  from: ArcEndpoint;
  to: ArcEndpoint;
  pair: ThreadPair;
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function ThreadLines({
  pairs,
  containerSelector,
}: ThreadLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [arcs, setArcs] = useState<ResolvedArc[]>([]);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Measure card positions and resolve arcs
  const measureArcs = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const container = containerSelector
      ? wrapper.closest(containerSelector) ?? wrapper.parentElement
      : wrapper.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const resolved: ResolvedArc[] = [];

    for (const pair of pairs) {
      const fromEl = container.querySelector(`[data-slug="${pair.fromSlug}"]`);
      const toEl = container.querySelector(`[data-slug="${pair.toSlug}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      resolved.push({
        from: {
          x: fromRect.left + fromRect.width / 2 - containerRect.left,
          y: fromRect.top + fromRect.height / 2 - containerRect.top,
        },
        to: {
          x: toRect.left + toRect.width / 2 - containerRect.left,
          y: toRect.top + toRect.height / 2 - containerRect.top,
        },
        pair,
      });
    }

    setArcs(resolved);
  }, [pairs, containerSelector]);

  const measureDebounced = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(measureArcs, RESIZE_DEBOUNCE_MS);
  }, [measureArcs]);

  // Initial measurement + resize observer
  useEffect(() => {
    // Wait for layout to settle
    const timer = setTimeout(measureArcs, 100);

    const observer = new ResizeObserver(measureDebounced);
    const wrapper = wrapperRef.current;
    if (wrapper?.parentElement) {
      observer.observe(wrapper.parentElement);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [measureArcs, measureDebounced]);

  // Draw arcs on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || arcs.length === 0) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rc = rough.canvas(canvas);

    for (const arc of arcs) {
      const isConnected =
        hoveredSlug === arc.pair.fromSlug ||
        hoveredSlug === arc.pair.toSlug;
      const isDimmed = hoveredSlug !== null && !isConnected;

      const opacity = isDimmed ? 0.12 : hoveredSlug !== null ? 0.6 : 0.25;

      ctx.globalAlpha = opacity;

      // Bezier control points: arc curves outward
      const midX = (arc.from.x + arc.to.x) / 2;
      const midY = (arc.from.y + arc.to.y) / 2;
      const dx = arc.to.x - arc.from.x;
      const dy = arc.to.y - arc.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular offset for the arc (proportional to distance)
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const arcOffset = Math.min(dist * 0.3, 80);

      rc.curve(
        [
          [arc.from.x, arc.from.y],
          [midX + perpX * arcOffset, midY + perpY * arcOffset],
          [arc.to.x, arc.to.y],
        ],
        {
          roughness: 1.2,
          strokeWidth: WEIGHT_STROKE[arc.pair.weight],
          stroke: arc.pair.color,
          bowing: 0.5,
          seed: hashSeed(`${arc.pair.fromSlug}-${arc.pair.toSlug}`),
        },
      );
    }

    ctx.globalAlpha = 1;
  }, [arcs, hoveredSlug]);

  // IntersectionObserver: draw-on animation
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || drawn) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  // Listen for hover on cards with data-slug
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    function handleMouseOver(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        setHoveredSlug(card.getAttribute('data-slug'));
      }
    }

    function handleMouseOut(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !card.contains(related)) {
          setHoveredSlug(null);
        }
      }
    }

    parent.addEventListener('mouseover', handleMouseOver);
    parent.addEventListener('mouseout', handleMouseOut);

    return () => {
      parent.removeEventListener('mouseover', handleMouseOver);
      parent.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  if (pairs.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 pointer-events-none hidden md:block"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          opacity: drawn ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
      />
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds. Component exists but is not rendered yet.

**Step 3: Commit**

```bash
git add src/components/ThreadLines.tsx
git commit -m "feat(connections): create ThreadLines component for listing page arcs"
```

---

### Task 9: Add thread lines to `/essays` listing page

**Files:**
- Modify: `src/app/essays/page.tsx`

**Step 1: Add imports and compute thread pairs**

Add imports near the top of the file (after existing imports):

```ts
import { getCollection as getCollectionRaw } from '@/lib/content';
import type { FieldNote, ShelfEntry } from '@/lib/content';
import { computeThreadPairs } from '@/lib/connectionEngine';
import type { AllContent } from '@/lib/connectionEngine';
import ThreadLines from '@/components/ThreadLines';
```

Note: `getCollection` is already imported. Only add the new imports (`FieldNote`, `ShelfEntry` types, `computeThreadPairs`, `AllContent`, `ThreadLines`).

Inside the `EssaysPage` function, after the `essays` variable, add:

```ts
// Compute thread pairs for thread lines between connected cards
const threadContent: AllContent = {
  essays,
  fieldNotes: getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft),
  shelf: getCollection<ShelfEntry>('shelf'),
};
const threadPairs = computeThreadPairs(threadContent);
```

**Step 2: Add `data-slug` to essay cards**

On the featured essay's `RoughBox` wrapper (around line 43), add `data-slug`:

```tsx
<RoughBox padding={0} hover tint="terracotta" elevated data-slug={featured.slug}>
```

Wait: `RoughBox` might not forward arbitrary props. Check first. If it doesn't forward `data-slug`, wrap the RoughBox or add the attribute to the inner div. The safest approach: wrap the featured essay section in a div with `data-slug`:

For the featured essay, wrap the `<RoughBox>` in a div:

```tsx
<div data-slug={featured.slug}>
  <RoughBox padding={0} hover tint="terracotta" elevated>
    {/* ... existing content ... */}
  </RoughBox>
</div>
```

For the remaining essays in the grid (around line 91), wrap each `<EssayCard>` in a div:

```tsx
{essays.slice(1).map((essay) => (
  <div key={essay.slug} data-slug={essay.slug}>
    <EssayCard
      title={essay.data.title}
      summary={essay.data.summary}
      date={essay.data.date}
      youtubeId={essay.data.youtubeId}
      tags={essay.data.tags}
      href={`/essays/${essay.slug}`}
      stage={essay.data.stage}
      slug={essay.slug}
    />
  </div>
))}
```

**Step 3: Add relative positioning and ThreadLines to the page**

Wrap the entire card area (featured + grid) in a `position: relative` container and render `ThreadLines`:

```tsx
<div className="relative">
  <ThreadLines pairs={threadPairs} />

  {/* Featured essay: full width */}
  {essays[0] && (() => {
    // ... existing featured essay code ...
  })()}

  {/* Remaining essays: 2-column grid */}
  {essays.length > 1 && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {/* ... existing map ... */}
    </div>
  )}
</div>
```

**Step 4: Verify build and visual result**

Run: `npm run build`
Expected: Build succeeds. In dev, visiting `/essays` should show faint arcs between `the-sidewalk-tax` and `the-parking-lot-problem` cards (they have `related` pointing at each other).

**Step 5: Commit**

```bash
git add src/app/essays/page.tsx
git commit -m "feat(connections): add thread lines to essays listing page"
```

---

### Task 10: Add thread lines to homepage

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add imports**

Add near the top imports:

```ts
import type { FieldNote as FieldNoteType, ShelfEntry } from '@/lib/content';
import { computeThreadPairs } from '@/lib/connectionEngine';
import type { AllContent } from '@/lib/connectionEngine';
import ThreadLines from '@/components/ThreadLines';
```

Note: Be careful with naming. `FieldNote` might already be imported as a type. Use the existing import if present.

**Step 2: Compute thread pairs inside HomePage**

After the existing content fetches (around line 52), add:

```ts
// Thread pairs for connecting cards within sections
const allFieldNotesForThreads = getCollection<FieldNote>('field-notes').filter((n) => !n.data.draft);
const allShelfForThreads = getCollection<ShelfEntry>('shelf');
const threadContent: AllContent = {
  essays,
  fieldNotes: allFieldNotesForThreads,
  shelf: allShelfForThreads,
};
const threadPairs = computeThreadPairs(threadContent);

// Split pairs by section: essay-to-essay threads for essay section,
// field-note-to-essay threads could connect across sections (deferred)
const essayThreadPairs = threadPairs.filter((p) => p.type === 'essay');
```

**Step 3: Add `data-slug` to essay cards**

For the featured essay, add `data-slug` to the wrapper div (the one with `className="lg:-mx-4 xl:-mx-8 relative"`):

```tsx
<div
  className="lg:-mx-4 xl:-mx-8 relative"
  style={{ paddingTop: featuredCollage ? 180 : 0 }}
  data-slug={featured.slug}
>
```

For secondary essays (around line 267), add `data-slug` to the `<ScrollReveal>` wrapper:

```tsx
<ScrollReveal key={essay.slug} data-slug={essay.slug}>
```

Wait: `ScrollReveal` may not forward `data-slug`. Check if it forwards arbitrary props. If not, wrap or add to an inner element. Safest: wrap in a div:

```tsx
<div key={essay.slug} data-slug={essay.slug}>
  <ScrollReveal>
    {/* ... existing content ... */}
  </ScrollReveal>
</div>
```

**Step 4: Add relative positioning and ThreadLines to the essays section**

Wrap the featured + secondary essays in a relative container with ThreadLines:

The featured essay section (starting around line 84) and secondary essays section (starting around line 257) should be wrapped together:

```tsx
<div className="relative">
  <ThreadLines pairs={essayThreadPairs} />

  {/* Featured Essay section */}
  {featured && (
    <section className="md:py-12" ...>
      {/* ... existing ... */}
    </section>
  )}

  {/* Secondary essays */}
  {essays.length > 1 && (
    <section className="py-6">
      {/* ... existing ... */}
    </section>
  )}
</div>
```

**Step 5: Verify build and visual result**

Run: `npm run build`
Expected: Build succeeds. Homepage shows faint arcs between connected essay cards.

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(connections): add thread lines to homepage essay section"
```

---

### Task 11: Final verification and cleanup

**Files:**
- Check: All modified files

**Step 1: Full build verification**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings related to connections.

**Step 2: Verify no orphaned imports**

Run: `grep -r "ConnectionMap\|ConnectionContext\|ConnectionProvider\|useConnectionHighlight" src/ --include="*.tsx" --include="*.ts"`
Expected: No results.

**Step 3: Visual verification checklist**

Start dev server (`npm run dev`) and verify:

1. `/essays/the-sidewalk-tax`: No footer connection map. Inline callout appears if the slug-word match found a mention in the text. Margin dot appears if no mention found. Dot hover shows card with title. Dot click navigates to connected content.

2. `/essays/the-parking-lot-problem`: Same checks as above.

3. `/essays`: Thread lines visible between the-sidewalk-tax and the-parking-lot-problem cards (faint arcs). Hovering a card brightens its thread lines and dims others.

4. Homepage: Thread lines visible between connected essay cards.

5. Mobile (resize to <768px): Thread lines hidden. Inline callouts still visible.

**Step 4: Commit any final adjustments**

If visual tweaks are needed (opacity, spacing, colors), make them and commit:

```bash
git add -A
git commit -m "fix(connections): polish woven connection surfaces"
```

**Step 5: Push to deploy**

```bash
git push
```
