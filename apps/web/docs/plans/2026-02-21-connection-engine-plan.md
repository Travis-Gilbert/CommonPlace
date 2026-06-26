# Connection Engine Implementation Plan

> **For Claude:** REQUIRED: Use /execute-plan to implement this plan task-by-task.

**Goal:** Surface explicit editorial relationships between content entries as rough.js animated bezier curves on essay detail pages, with margin dots while reading and a freeform scatter connection map in the footer.

**Architecture:** Pure TypeScript engine module (`connectionEngine.ts`) computes connections at build time in the Server Component. Two Client Components consume the output: `ConnectionDots` (margin indicators) and `ConnectionMap` (footer scatter with rough.js curves). Shared highlight state via React context. The engine is framework-agnostic and extensible to other pages later.

**Tech Stack:** TypeScript, React 19, Next.js 15 (App Router, Server Components), rough.js (already installed), IntersectionObserver, CSS transitions

---

### Task 1: Connection Engine Module (Types and Core Function)

**Files:**
- Create: `src/lib/connectionEngine.ts`

**Step 1: Create the module with types and `computeConnections()`**

```ts
// src/lib/connectionEngine.ts

import type { ContentEntry, Essay, FieldNote, ShelfEntry } from './content';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type ConnectionType = 'essay' | 'field-note' | 'shelf';
export type ConnectionWeight = 'heavy' | 'medium' | 'light';

export interface Connection {
  /** Deterministic identifier: `${type}-${slug}` */
  id: string;
  type: ConnectionType;
  slug: string;
  title: string;
  /** Short description: essay summary, note excerpt, or shelf annotation */
  summary?: string;
  /** Section color hex for rendering */
  color: string;
  /** Stroke weight tier for visual hierarchy */
  weight: ConnectionWeight;
  date: string; // ISO string for RSC serialization
}

/** Connection with its resolved paragraph position (null = footer only) */
export interface PositionedConnection {
  connection: Connection;
  paragraphIndex: number | null;
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const TYPE_COLOR: Record<ConnectionType, string> = {
  essay: '#B45A2D',       // terracotta
  'field-note': '#2D5F6B', // teal
  shelf: '#C49A4A',        // gold
};

const TYPE_WEIGHT: Record<ConnectionType, ConnectionWeight> = {
  essay: 'heavy',
  'field-note': 'medium',
  shelf: 'light',
};

export const WEIGHT_STROKE: Record<ConnectionWeight, number> = {
  heavy: 1.8,
  medium: 1.2,
  light: 0.8,
};

// ─────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────

interface AllContent {
  essays: ContentEntry<Essay>[];
  fieldNotes: ContentEntry<FieldNote>[];
  shelf: ContentEntry<ShelfEntry>[];
}

/**
 * Compute all explicit connections for a given essay.
 *
 * Three link types:
 *   1. essay.data.related slugs -> other essays
 *   2. field notes where connectedTo === essay slug
 *   3. shelf entries where connectedEssay === essay slug
 */
export function computeConnections(
  essay: ContentEntry<Essay>,
  content: AllContent,
): Connection[] {
  const connections: Connection[] = [];

  // 1. Related essays (explicit slugs in frontmatter)
  for (const relatedSlug of essay.data.related) {
    const match = content.essays.find(
      (e) => e.slug === relatedSlug && !e.data.draft
    );
    if (match) {
      connections.push({
        id: `essay-${match.slug}`,
        type: 'essay',
        slug: match.slug,
        title: match.data.title,
        summary: match.data.summary,
        color: TYPE_COLOR.essay,
        weight: TYPE_WEIGHT.essay,
        date: match.data.date.toISOString(),
      });
    }
  }

  // 2. Field notes pointing at this essay
  for (const note of content.fieldNotes) {
    if (note.data.connectedTo === essay.slug && !note.data.draft) {
      connections.push({
        id: `field-note-${note.slug}`,
        type: 'field-note',
        slug: note.slug,
        title: note.data.title,
        summary: note.data.excerpt,
        color: TYPE_COLOR['field-note'],
        weight: TYPE_WEIGHT['field-note'],
        date: note.data.date.toISOString(),
      });
    }
  }

  // 3. Shelf entries connected to this essay
  for (const item of content.shelf) {
    if (item.data.connectedEssay === essay.slug) {
      connections.push({
        id: `shelf-${item.slug}`,
        type: 'shelf',
        slug: item.slug,
        title: item.data.title,
        summary: item.data.annotation,
        color: TYPE_COLOR.shelf,
        weight: TYPE_WEIGHT.shelf,
        date: item.data.date.toISOString(),
      });
    }
  }

  return connections;
}
```

**Step 2: Commit**

```bash
git add src/lib/connectionEngine.ts
git commit -m "feat(connections): add connection engine with computeConnections"
```

---

### Task 2: First-Mention Detection (`findMentionIndex`)

**Files:**
- Modify: `src/lib/connectionEngine.ts`

**Step 1: Add `findMentionIndex()` and `positionConnections()` to the engine**

Append to `src/lib/connectionEngine.ts`:

```ts
// ─────────────────────────────────────────────────
// Paragraph mention detection
// ─────────────────────────────────────────────────

/**
 * Scan rendered HTML for the first paragraph that mentions a connection's title.
 *
 * Returns the 1-based paragraph index (matching the convention used by
 * injectAnnotations and measureParagraphOffsets), or null if no mention found.
 *
 * Uses case-insensitive substring matching within paragraph segments.
 * Index convention: paragraph 1 = first closing paragraph tag occurrence.
 */
export function findMentionIndex(
  connection: Connection,
  html: string,
): number | null {
  const needle = connection.title.toLowerCase();

  // Split on closing paragraph tags to isolate paragraph contents.
  // Each segment before the tag contains the paragraph's HTML.
  const segments = html.split('</p>');

  for (let i = 0; i < segments.length - 1; i++) {
    // Strip HTML tags to get plain text for matching
    const plainText = segments[i].replace(/<[^>]*>/g, '').toLowerCase();
    if (plainText.includes(needle)) {
      return i + 1; // 1-based index
    }
  }

  return null;
}

/**
 * Resolve paragraph positions for all connections against rendered HTML.
 * Connections with no mention get paragraphIndex: null (footer-only).
 */
export function positionConnections(
  connections: Connection[],
  html: string,
): PositionedConnection[] {
  return connections.map((connection) => ({
    connection,
    paragraphIndex: findMentionIndex(connection, html),
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/connectionEngine.ts
git commit -m "feat(connections): add first-mention paragraph detection"
```

---

### Task 3: Connection Context (Shared Highlight State)

**Files:**
- Create: `src/components/ConnectionContext.tsx`

**Step 1: Create the context provider**

```tsx
// src/components/ConnectionContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ConnectionContextValue {
  highlightedId: string | null;
  setHighlightedId: (id: string | null) => void;
  toggleHighlight: (id: string) => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  highlightedId: null,
  setHighlightedId: () => {},
  toggleHighlight: () => {},
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const toggleHighlight = useCallback((id: string) => {
    setHighlightedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <ConnectionContext.Provider value={{ highlightedId, setHighlightedId, toggleHighlight }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionHighlight() {
  return useContext(ConnectionContext);
}
```

**Step 2: Commit**

```bash
git add src/components/ConnectionContext.tsx
git commit -m "feat(connections): add shared highlight context"
```

---

### Task 4: ConnectionDots (Margin Indicators)

**Files:**
- Create: `src/components/ConnectionDots.tsx`

**Context for implementer:** This component sits in the left margin of the article prose. The right margin is used by `StickyNoteLayer` for comments (see `src/components/StickyNoteLayer.tsx`). It uses the same `measureParagraphOffsets` function from `src/lib/paragraphPositions.ts` that `StickyNoteLayer` uses. It must wait for `document.fonts.ready` before measuring, and re-measure on resize.

When a dot is clicked, it sets the highlight in `ConnectionContext` and smooth-scrolls to the footer `ConnectionMap` via element ID `connection-map`.

**Step 1: Create `ConnectionDots.tsx`**

```tsx
// src/components/ConnectionDots.tsx
'use client';

import { useState, useEffect, useCallback, type RefObject } from 'react';
import { measureParagraphOffsets } from '@/lib/paragraphPositions';
import { useConnectionHighlight } from '@/components/ConnectionContext';
import type { PositionedConnection } from '@/lib/connectionEngine';

interface ConnectionDotsProps {
  connections: PositionedConnection[];
  proseRef: RefObject<HTMLDivElement>;
}

export default function ConnectionDots({
  connections,
  proseRef,
}: ConnectionDotsProps) {
  const [offsets, setOffsets] = useState<Map<number, number>>(new Map());
  const { highlightedId, toggleHighlight } = useConnectionHighlight();

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

  // Only show connections that have a paragraph position
  const positioned = connections.filter((c) => c.paragraphIndex !== null);
  if (positioned.length === 0) return null;

  // Group by paragraph index for stacking
  const byParagraph = new Map<number, PositionedConnection[]>();
  for (const pc of positioned) {
    const idx = pc.paragraphIndex!;
    const group = byParagraph.get(idx) || [];
    group.push(pc);
    byParagraph.set(idx, group);
  }

  function handleClick(id: string) {
    toggleHighlight(id);

    // Smooth-scroll to the footer connection map
    const mapEl = document.getElementById('connection-map');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
          const isHighlighted = highlightedId === pc.connection.id;

          return (
            <button
              key={pc.connection.id}
              className="absolute pointer-events-auto transition-all duration-200"
              style={{
                top: yOffset + i * 12,
                right: 16,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: pc.connection.color,
                opacity: highlightedId && !isHighlighted ? 0.25 : 0.7,
                transform: isHighlighted ? 'scale(1.5)' : 'scale(1)',
                boxShadow: isHighlighted
                  ? `0 0 0 2px ${pc.connection.color}40`
                  : 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => handleClick(pc.connection.id)}
              aria-label={`Connected: ${pc.connection.title}`}
              title={pc.connection.title}
            />
          );
        });
      })}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ConnectionDots.tsx
git commit -m "feat(connections): add margin dot indicators"
```

---

### Task 5: ConnectionMap (Footer Scatter with Rough.js Curves)

**Files:**
- Create: `src/components/ConnectionMap.tsx`

**Context for implementer:** This is the most complex component. Key references:
- **Seeded PRNG pattern:** `src/components/PatternImage.tsx` lines 50-57
- **Rough.js canvas setup:** `src/components/rough/RoughCallout.tsx` (DPR scaling, `rough.canvas()`)
- **Stroke-draw animation:** `src/components/rough/DrawOnIcon.tsx` (IntersectionObserver + `strokeDashoffset`)
- **RoughBox wrapper:** `src/components/rough/RoughBox.tsx` (neutral tint for the container)
- **Stroke weights:** `WEIGHT_STROKE` exported from `src/lib/connectionEngine.ts`

The canvas draws rough.js bezier curves between the essay anchor (left-center) and scattered item positions. Cards are HTML elements absolutely positioned over the canvas. IntersectionObserver triggers staggered fade-in when the map scrolls into view.

**Step 1: Create `ConnectionMap.tsx`**

```tsx
// src/components/ConnectionMap.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import rough from 'roughjs';
import RoughBox from '@/components/rough/RoughBox';
import { useConnectionHighlight } from '@/components/ConnectionContext';
import type { Connection } from '@/lib/connectionEngine';
import { WEIGHT_STROKE } from '@/lib/connectionEngine';

interface ConnectionMapProps {
  essayTitle: string;
  connections: Connection[];
}

// ─────────────────────────────────────────────────
// Seeded PRNG (same algorithm as PatternImage)
// ─────────────────────────────────────────────────

function createPRNG(seed: string) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  }
  return () => {
    s = (s * 16807) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ─────────────────────────────────────────────────
// Layout computation
// ─────────────────────────────────────────────────

interface ItemPosition {
  x: number;
  y: number;
  connection: Connection;
}

/**
 * Place connected items in a freeform scatter to the right of the essay anchor.
 * Items cluster loosely by type (essays upper, field notes middle, shelf lower).
 * Minimum distance constraint prevents overlap.
 */
function computeScatterPositions(
  connections: Connection[],
  containerW: number,
  containerH: number,
): ItemPosition[] {
  if (connections.length === 0) return [];

  const rand = createPRNG(connections.map((c) => c.id).join(','));
  const positions: ItemPosition[] = [];

  // Vertical bands by type
  const typeBand: Record<string, [number, number]> = {
    essay: [0.1, 0.35],
    'field-note': [0.35, 0.65],
    shelf: [0.65, 0.9],
  };

  // Items scatter in the right 70% of the container
  const minX = containerW * 0.35;
  const maxX = containerW * 0.85;
  const minDist = 80; // minimum distance between items (px)

  for (const connection of connections) {
    const [bandMin, bandMax] = typeBand[connection.type] || [0.2, 0.8];
    let x: number, y: number;
    let attempts = 0;

    // Try to find a non-overlapping position
    do {
      x = minX + rand() * (maxX - minX);
      y = containerH * (bandMin + rand() * (bandMax - bandMin));
      attempts++;
    } while (
      attempts < 50 &&
      positions.some(
        (p) => Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2) < minDist
      )
    );

    positions.push({ x, y, connection });
  }

  return positions;
}

/** Convert a string to a numeric seed for rough.js deterministic drawing */
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

const MAP_HEIGHT = 400;
const ANCHOR_X = 60;

export default function ConnectionMap({
  essayTitle,
  connections,
}: ConnectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<ItemPosition[]>([]);
  const [containerW, setContainerW] = useState(600);
  const [drawn, setDrawn] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const { highlightedId, toggleHighlight, setHighlightedId } =
    useConnectionHighlight();

  // Measure container and compute positions
  const layout = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    setContainerW(w);
    setPositions(computeScatterPositions(connections, w, MAP_HEIGHT));
  }, [connections]);

  useEffect(() => {
    layout();
    const observer = new ResizeObserver(layout);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [layout]);

  // Draw rough.js curves on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerW * dpr;
    canvas.height = MAP_HEIGHT * dpr;
    canvas.style.width = `${containerW}px`;
    canvas.style.height = `${MAP_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerW, MAP_HEIGHT);

    const rc = rough.canvas(canvas);
    const anchorY = MAP_HEIGHT / 2;

    for (const pos of positions) {
      const isHighlighted = highlightedId === pos.connection.id;
      const isDimmed = highlightedId !== null && !isHighlighted;

      const strokeWidth =
        WEIGHT_STROKE[pos.connection.weight] + (isHighlighted ? 0.5 : 0);
      const opacity = isDimmed ? 0.15 : 1;

      ctx.globalAlpha = opacity;

      // Bezier control points: curve arcs organically
      const midX = (ANCHOR_X + pos.x) / 2;
      const cpOffsetY = (pos.y - anchorY) * 0.4;

      rc.curve(
        [
          [ANCHOR_X, anchorY],
          [midX, anchorY + cpOffsetY * 0.5],
          [midX + 20, pos.y - cpOffsetY * 0.3],
          [pos.x, pos.y],
        ],
        {
          roughness: 1.2,
          strokeWidth,
          stroke: pos.connection.color,
          bowing: 0.5,
          seed: hashSeed(pos.connection.id),
        },
      );
    }

    ctx.globalAlpha = 1;
  }, [positions, containerW, highlightedId]);

  // IntersectionObserver: trigger draw-on animation
  useEffect(() => {
    const el = containerRef.current;
    if (!el || drawn) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setSkipAnimation(true);
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
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  // Escape key deselects
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && highlightedId) {
        setHighlightedId(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [highlightedId, setHighlightedId]);

  if (connections.length === 0) return null;

  return (
    <section id="connection-map" className="py-6">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-light mb-1">
        Connections
      </h2>
      <p
        className="text-xs text-ink-secondary mb-3 max-w-prose"
        style={{ fontFamily: 'var(--font-annotation)' }}
      >
        {connections.length} connected{' '}
        {connections.length === 1 ? 'piece' : 'pieces'}
      </p>
      <RoughBox tint="neutral" elevated={false} padding={0}>
        <div
          ref={containerRef}
          className="relative"
          style={{ height: MAP_HEIGHT, overflow: 'hidden' }}
          onClick={(e) => {
            // Click on empty space deselects
            if (
              e.target === e.currentTarget ||
              e.target === canvasRef.current
            ) {
              setHighlightedId(null);
            }
          }}
        >
          {/* Rough.js curve canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: drawn ? 1 : 0,
              transition: skipAnimation
                ? 'none'
                : 'opacity 600ms ease-out',
            }}
            aria-hidden="true"
          />

          {/* Essay anchor (left-center) */}
          <div
            className="absolute flex items-center"
            style={{
              left: ANCHOR_X - 40,
              top: MAP_HEIGHT / 2 - 20,
              width: 80,
            }}
          >
            <div
              className="text-center w-full text-[11px] font-title font-bold leading-tight"
              style={{ color: 'var(--color-ink)' }}
            >
              {essayTitle.length > 30
                ? essayTitle.slice(0, 28) + '...'
                : essayTitle}
            </div>
          </div>

          {/* Scatter items */}
          {positions.map((pos, i) => {
            const isHighlighted = highlightedId === pos.connection.id;
            const isDimmed =
              highlightedId !== null && !isHighlighted;

            // Stagger order: heavy first, then medium, then light
            const weightOrder: Record<string, number> = {
              heavy: 0,
              medium: 1,
              light: 2,
            };
            const staggerDelay =
              (weightOrder[pos.connection.weight] ?? 2) * 200 + i * 100;

            return (
              <button
                key={pos.connection.id}
                className="absolute text-left transition-all duration-300 rounded px-2 py-1.5 border-l-2 cursor-pointer bg-transparent"
                style={{
                  left: pos.x,
                  top: pos.y - 16,
                  maxWidth: 180,
                  borderLeftColor: pos.connection.color,
                  opacity: !drawn ? 0 : isDimmed ? 0.2 : 1,
                  transform: !drawn
                    ? 'translateY(8px)'
                    : 'translateY(0)',
                  transition: skipAnimation
                    ? 'opacity 300ms ease, transform 0ms'
                    : `opacity 400ms ease-out ${staggerDelay}ms, transform 400ms ease-out ${staggerDelay}ms`,
                  boxShadow: isHighlighted
                    ? `0 2px 8px ${pos.connection.color}30`
                    : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHighlight(pos.connection.id);
                }}
                aria-label={`${pos.connection.title} (${pos.connection.type})`}
              >
                <span
                  className="block font-mono uppercase tracking-[0.08em]"
                  style={{
                    fontSize: 9,
                    color: pos.connection.color,
                  }}
                >
                  {pos.connection.type === 'field-note'
                    ? 'field note'
                    : pos.connection.type}
                </span>
                <span
                  className="block font-title text-xs font-semibold leading-tight mt-0.5"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {pos.connection.title}
                </span>
              </button>
            );
          })}
        </div>
      </RoughBox>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ConnectionMap.tsx
git commit -m "feat(connections): add footer scatter map with rough.js curves"
```

---

### Task 6: Integrate into Essay Detail Page

**Files:**
- Modify: `src/components/ArticleBody.tsx`
- Modify: `src/app/essays/[slug]/page.tsx`

**Context for implementer:**
- `ArticleBody` (`src/components/ArticleBody.tsx`) is a thin Client Component wrapper holding a ref to the prose container. `ConnectionDots` needs this ref to measure paragraph positions.
- The essay detail page (`src/app/essays/[slug]/page.tsx`) is a Server Component that already loads all content collections.
- `ArticleBody` currently accepts 4 props: `html`, `className`, `contentType`, `articleSlug`. It renders `ArticleComments` internally. We add a `renderMarginContent` render prop so it can pass its `proseRef` to `ConnectionDots`.

**Step 1: Modify `ArticleBody.tsx` to add render prop**

Add `renderMarginContent` optional prop. The component passes its `proseRef` to this function. The return value renders inside the `article-body-wrapper` div (which has `position: relative`).

Current interface has 4 props. Add a 5th:

```ts
/** Render prop receiving the prose ref for margin-positioned content */
renderMarginContent?: (proseRef: RefObject<HTMLDivElement>) => ReactNode;
```

Add `type ReactNode` to the existing import from `react`. Call the render prop inside the wrapper div, between the prose div and `ArticleComments`.

**Step 2: Modify `src/app/essays/[slug]/page.tsx`**

Add imports at the top (after existing imports):

```tsx
import { computeConnections, positionConnections } from '@/lib/connectionEngine';
import { ConnectionProvider } from '@/components/ConnectionContext';
import ConnectionDots from '@/components/ConnectionDots';
import ConnectionMap from '@/components/ConnectionMap';
```

After the existing `const collageImage = ...` line (~line 105), add:

```tsx
  // Connection engine: compute at build time
  const allContent = {
    essays: getCollection<Essay>('essays').filter((e) => !e.data.draft),
    fieldNotes: allFieldNotes,
    shelf: allShelf,
  };
  const engineConnections = computeConnections(entry, allContent);
  const positionedConnections = positionConnections(engineConnections, html);
```

Wrap the `<article>` element (and its siblings `ArticleJsonLd` and `ReadingProgress`) inside `<ConnectionProvider>`.

Update the `<ArticleBody>` usage to pass the render prop:

```tsx
<ArticleBody
  html={html}
  className="prose prose-essays mt-8"
  contentType="essays"
  articleSlug={slug}
  renderMarginContent={(proseRef) =>
    positionedConnections.length > 0 ? (
      <ConnectionDots
        connections={positionedConnections}
        proseRef={proseRef}
      />
    ) : null
  }
/>
```

Insert the `ConnectionMap` between the related field notes section (the IIFE ending ~line 238) and the prev/next `<nav>` element (~line 240):

```tsx
{/* Connection map: freeform scatter with rough.js curves */}
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

**Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no type errors.

**Step 4: Commit**

```bash
git add src/app/essays/[slug]/page.tsx src/components/ArticleBody.tsx
git commit -m "feat(connections): integrate engine into essay detail page"
```

---

### Task 7: Dev Server Smoke Test and Visual Verification

**Files:** None (testing only)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test `/essays/the-sidewalk-tax`**

This essay has:
- `related: ["the-parking-lot-problem"]` (1 terracotta connection)
- Field note `against-legibility-in-public-space` with `connectedTo: the-sidewalk-tax` (1 teal connection)

Expected:
- [ ] Margin dots: at least 1 dot visible in left margin on xl+ viewport (terracotta for the related essay; teal if the field note title appears in the prose)
- [ ] Footer map: "Connections" heading with "2 connected pieces" label
- [ ] Rough.js curves: 2 curves from essay anchor to scattered items
- [ ] Curves animate on when scrolled into view (staggered)
- [ ] Click a dot: smooth-scrolls to footer map
- [ ] Click a footer card: that connection highlights, others dim to 20%
- [ ] Click same card again: deselects, all return to full opacity
- [ ] Press Escape: deselects
- [ ] Mobile viewport (below xl): no margin dots, footer map still renders

**Step 3: Test `/essays/the-parking-lot-problem`**

This essay has:
- `related: ["the-sidewalk-tax"]` (1 terracotta connection)
- No field notes point at it

Expected:
- [ ] 1 terracotta connection in footer map
- [ ] Margin dot appears if "The Sidewalk Tax" is mentioned in the prose

**Step 4: Test `prefers-reduced-motion`**

In Chrome DevTools > Rendering > Emulate CSS media feature `prefers-reduced-motion: reduce`

Expected: All curves and cards appear immediately without animation.

**Step 5: Fix any issues found, then commit**

If fixes needed:
```bash
git add -A
git commit -m "fix(connections): address visual and interaction polish"
```

---

### Task 8: Lint and Final Build

**Step 1: Lint**

Run: `npm run lint`
Expected: No errors in new files.

**Step 2: Production build**

Run: `npm run build`
Expected: Clean build, no warnings.

**Step 3: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(connections): lint cleanup"
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/connectionEngine.ts` | Create | Pure engine: types, `computeConnections()`, `findMentionIndex()`, `positionConnections()` |
| `src/components/ConnectionContext.tsx` | Create | Shared `highlightedId` state via React context |
| `src/components/ConnectionDots.tsx` | Create | Margin dot indicators (xl+ desktop only) |
| `src/components/ConnectionMap.tsx` | Create | Footer freeform scatter with rough.js bezier curves |
| `src/components/ArticleBody.tsx` | Modify | Add `renderMarginContent` render prop |
| `src/app/essays/[slug]/page.tsx` | Modify | Call engine, wrap in `ConnectionProvider`, render both components |

## Test Content

For manual testing, these content entries have explicit connections:

| Content | Type | Connection |
|---------|------|-----------|
| `the-parking-lot-problem.md` | Essay | `related: ["the-sidewalk-tax"]` |
| `the-sidewalk-tax.md` | Essay | `related: ["the-parking-lot-problem"]` |
| `against-legibility-in-public-space.md` | Field Note | `connectedTo: the-sidewalk-tax` |

No shelf entries have `connectedEssay` set yet. To test the full trifecta, add `connectedEssay: the-parking-lot-problem` to a shelf entry's frontmatter (e.g., `the-power-broker.md`).
