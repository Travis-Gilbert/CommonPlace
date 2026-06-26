# Implementation Plan: Branding Overhaul, Homepage Restructure & Interaction Design

> **Branch:** `feature/branding-homepage-interactions`
> **Source spec:** `~/Downloads/files (21)/plan-01-branding-homepage-interactions.md`
> **Estimated batches:** 8 phases, 19 tasks

---

## Phase 1: Font Stack Update

### Task 1.1: Add JetBrains Mono font declaration

**Files:** `src/app/fonts.ts`, `src/styles/global.css`

**Steps:**
1. In `fonts.ts`, import `JetBrains_Mono` from `next/font/google` with weights 400 and 700, `display: 'swap'`, `variable: '--font-jetbrains-mono'`
2. Add `jetBrainsMono` to the `fontVariableClasses` concatenation string
3. In `global.css` `@theme inline` block, add: `--font-code: var(--font-jetbrains-mono), var(--font-courier-prime), monospace;`

**Acceptance criteria:**
- `npm run build` succeeds with no font loading errors
- `--font-code` CSS variable resolves in browser dev tools
- Existing fonts unaffected

**Gotchas:**
- Must follow the existing pattern: each font gets its own `variable` property and is included in `fontVariableClasses`
- The alias bridge in `@theme inline` is required for Tailwind to see the variable

---

## Phase 2: Tagline & Hero Restructure

### Task 2.1: Create PipelineCounter component

**New file:** `src/components/PipelineCounter.tsx`

**Steps:**
1. Create Server Component (no `'use client'`)
2. Import `getCollection` from `@/lib/content`
3. Fetch essays and field notes, count by stage/status
4. Map field note statuses to unified buckets: observation -> researching, developing -> drafting, connected -> published
5. Render as: `2 RESEARCHING · 1 DRAFTING · 1 IN PRODUCTION · 3 PUBLISHED`
6. Each count: Courier Prime, 11px, uppercase, letter-spacing 0.08em
7. Colors: researching = teal, drafting = terracotta, production = gold, published = green (#5A7A4A)
8. Middot separator: `--color-ink-muted`
9. Omit stages with 0 items
10. Wrap in `<div>` with `aria-label="Content pipeline status"`

**Acceptance criteria:**
- Renders pipeline counts from actual content data
- Zero-count stages are hidden
- Typography matches existing `countersLabel` style (Courier Prime, 11px, uppercase)

### Task 2.2: Update CollageHero props and layout

**File:** `src/components/CollageHero.tsx`

**Steps:**
1. Change props interface:
   - Remove `countersLabel: string` and `tagline: React.ReactNode`
   - Add `pipelineStatus: React.ReactNode`
2. Add static tagline: "Hey, I'm working here" in Vollkorn 700, 26px, color `--color-ink-secondary`
3. Below static tagline, render `pipelineStatus` slot
4. Remove `countersLabel` rendering
5. Add `<RoughUnderline>` under the word "here" in the tagline (terracotta color)
   - "here" must be wrapped in a `<span style={{ position: 'relative', display: 'inline-block' }}>` so RoughUnderline can position relative to it

**Acceptance criteria:**
- Hero renders: name, then "Hey, I'm working here" (with rough underline on "here"), then pipeline counts
- NowPreview still renders on the right
- No TypeScript errors from changed props

**Gotchas:**
- RoughUnderline is a Client Component drawing on canvas; it needs a positioned parent
- The grid layout (`1fr 118px 1fr`) and `lg:pl-[128px]` must remain unchanged

### Task 2.3: Wire up homepage to new hero

**File:** `src/app/page.tsx`

**Steps:**
1. Remove `CyclingTagline` import
2. Add `PipelineCounter` import
3. Remove the `countersLabel` string construction (`${totalEssays} essays · ...`)
4. Update `<CollageHero>` invocation:
   - Remove `tagline={<CyclingTagline />}` and `countersLabel={countersLabel}`
   - Add `pipelineStatus={<PipelineCounter />}`

**Acceptance criteria:**
- Homepage hero shows name, static tagline with rough underline, pipeline counter, NowPreview
- No references to CyclingTagline remain in page.tsx
- Build succeeds

---

## Phase 3: Code-Comment Annotations (Homepage)

### Task 3.1: Create CodeComment component

**New file:** `src/components/CodeComment.tsx`

**Steps:**
1. Server Component (pure CSS, no canvas, no rough.js)
2. Props: `children: ReactNode`, `side?: 'left' | 'right'`, `tint?: 'terracotta' | 'teal' | 'gold' | 'neutral'`, `offsetY?: number`
3. Render structure:
   ```
   <div> (positioned absolute on lg+, inline on mobile)
     <span>#</span> (14px, tint color at 0.35 opacity, 6px gap after)
     <span>{children}</span> (12px, tint color at 0.7 opacity)
   </div>
   ```
4. Font: `var(--font-code)` (JetBrains Mono)
5. Desktop (lg+): absolute positioned in margin, matching RoughCallout positioning logic
   - `side='right'`: `left: calc(100% + 1.5rem)`
   - `side='left'`: `right: calc(100% + 1.5rem)`
6. Mobile: `position: static`, inline block below card content
7. `#` must NOT look like a hashtag: separate `<span>`, larger size (14px vs 12px), lower opacity (0.35 vs 0.7), 6px gap

**Acceptance criteria:**
- Renders as `# this one changed how I think about public space` in JetBrains Mono
- `#` is visually distinct from text (larger, dimmer, separated)
- Positioned in margins on desktop, inline on mobile
- No canvas, no animation, no rough.js

**Gotchas:**
- Outer wrapper of parent card needs `position: relative` for absolute positioning to work
- Must set `width: 450` and `maxWidth` overflow guard (same pattern as RoughCallout/RoughPivotCallout)

### Task 3.2: Replace callouts with CodeComment on homepage

**File:** `src/app/page.tsx`

**Steps:**
1. Import `CodeComment` from `@/components/CodeComment`
2. Replace `<RoughPivotCallout>` usages in the featured essay section with `<CodeComment>`
3. Preserve same `side`, `tint`, and content text
4. Keep `<RoughCallout>` / `<RoughPivotCallout>` imports available (still used on essay detail pages)
5. Remove unused callout imports only if no other usages remain in this file

**Acceptance criteria:**
- Homepage featured essay annotations render as code comments
- Essay detail pages still use handwritten RoughCallout style (verify `/essays/[slug]` pages unchanged)
- No TypeScript errors

---

## Phase 4: Navigation Rename

### Task 4.1: Rename nav label

**File:** `src/components/TopNav.tsx`

**Steps:**
1. In `DEFAULT_NAV_LINKS`, change `label: 'Essays on...'` to `label: 'Works in Progress'`

### Task 4.2: Update homepage section label

**File:** `src/app/page.tsx`

**Steps:**
1. Change `<RoughLine label="Essays on ..." ...>` to `<RoughLine label="Writing" ...>`
2. Change "All essays" link text to "All writing"

### Task 4.3: Update site.json nav

**File:** `src/config/site.json`

**Steps:**
1. Change the nav entry with `path: "/essays"` from `label: "Essays"` to `label: "Works in Progress"`

**Acceptance criteria (all 4.x):**
- Nav bar shows "Works in Progress" instead of "Essays on..."
- Homepage section heading says "Writing"
- "All writing" link still routes to `/essays`
- site.json nav matches TopNav

---

## Phase 5: Contextual Cursor States

### Task 5.1: Add cursor CSS styles

**File:** `src/styles/global.css`

**Steps:**
1. Add `.article-body-wrapper { cursor: text; }`
2. Add `[data-cursor="crosshair"] { cursor: crosshair; }`

### Task 5.2: Add reading line to ArticleBody

**File:** `src/components/ArticleBody.tsx`

**Steps:**
1. Add a `reading-line` div inside `article-body-wrapper`, positioned absolute, full width, 1px height
2. On `mousemove` over the prose container, update line's `top` to `clientY - containerRect.top`
3. Background: `var(--color-ink-muted)` at opacity 0.04, `pointer-events: none`
4. On `mouseleave`: opacity 0 (CSS transition `opacity 200ms ease`)
5. Skip on touch devices: check `window.matchMedia('(hover: none)')`
6. Respect `prefers-reduced-motion`: disable if reduced motion preferred
7. Use `useRef` for the line element and `useCallback` for mousemove handler

**Acceptance criteria:**
- Faint horizontal line follows cursor Y in essay prose
- Line disappears on mouseleave
- Not visible on touch devices
- No visible effect with `prefers-reduced-motion: reduce`

**Gotchas:**
- ArticleBody is already a Client Component (has useRef)
- `article-body-wrapper` already has `position: relative`

### Task 5.3: Add crosshair cursor to project cards

**Files:** `src/app/page.tsx`, `src/components/ProjectColumns.tsx`

**Steps:**
1. In `page.tsx`: add `data-cursor="crosshair"` to project card wrapper divs in the projects section
2. In `ProjectColumns.tsx`: add `data-cursor="crosshair"` to individual `ProjectCard` wrapper div

**Acceptance criteria:**
- Crosshair cursor appears when hovering over project cards on homepage and projects page

### Task 5.4: Add ink trail to DotGrid

**File:** `src/components/DotGrid.tsx`

**Steps:**
1. Add a `trailRef` using `useRef<Array<{x: number, y: number, time: number}>>([])` for recent cursor positions
2. In the existing `mousemove` handler, push `{ x, y, time: Date.now() }` every 50ms (throttle via timestamp check)
3. Cap trail array at 8 entries (shift oldest when full)
4. In `tick()` animation loop, BEFORE drawing grid dots:
   - Iterate trail array
   - For each point, calculate age: `Date.now() - point.time`
   - Skip if age > 500ms
   - Draw dot: radius 1.5px, color `--color-ink-muted`, opacity `0.04 * (1 - age/500)`
5. Remove expired entries (age > 500ms) each frame
6. Skip trail rendering during easter egg `phase === 'seed'`

**Acceptance criteria:**
- Extremely faint ink dots trail behind cursor over DotGrid background
- Trail fades over ~500ms
- No performance regression (still 60fps)
- Trail does not appear during easter egg seed phase

**Gotchas:**
- Draw ink trail BEFORE grid dots so they appear behind
- Use existing canvas context; no additional canvas element
- DPR scaling already handled by existing code

---

## Phase 6: Parallax Document Stack (Project Detail Pages)

### Task 6.1: Create ParallaxStack component

**New file:** `src/components/ParallaxStack.tsx`

**Steps:**
1. Client Component (`'use client'`)
2. Props: `children: React.ReactNode`, `intensity?: number` (default 0.03)
3. Wrap children in `position: relative` container
4. Use `React.Children.map` to clone each child with `data-parallax-layer={index}`
5. On scroll (`useEffect` + scroll listener):
   - Get container's `offsetTop` via ref
   - For each layer element, calculate: `displacement = (scrollY - containerOffsetTop) * intensity * layerIndex`
   - Cap displacement at +/- 15px
   - Apply `transform: translateY(${displacement}px)` via inline style or `style.transform`
6. Use `requestAnimationFrame` for smooth updates
7. Respect `prefers-reduced-motion` (no parallax)
8. Touch devices: reduce intensity by 50%

**Acceptance criteria:**
- Subtle vertical displacement between layers on scroll
- Displacement capped at +/- 15px
- No effect with `prefers-reduced-motion: reduce`
- Cleanup: event listeners removed on unmount

### Task 6.2: Apply ParallaxStack to projects page

**File:** `src/app/projects/page.tsx`

**Steps:**
1. Import `ParallaxStack`
2. Wrap project content area:
   - Layer 0: subtle blueprint grid pattern div (40px grid, 15% opacity, `pointer-events: none`)
   - Layer 1: main project content (ProjectColumns)
   - Layer 2: related content links (if any)
3. Add subtle warm shadow + seeded rotation to foreground cards
4. Seeded rotation: use `mulberry32` PRNG from slug, range 0.3 to 1.2 degrees

**Acceptance criteria:**
- Scroll the projects page; subtle vertical displacement between layers
- Effect is barely perceptible but creates physical depth
- No layout shift or content overlap

---

## Phase 7: ConnectionMap Page

### Task 7.1: Create ConnectionMap visualization

**New file:** `src/components/ConnectionMap.tsx`

**Steps:**
1. Client Component (`'use client'`)
2. Import D3 force simulation (d3-force, d3-selection) matching pattern from research_api's SourceGraph
3. Data: use `computeThreadPairs()` from `@/lib/connectionEngine` or accept pre-computed data as props
4. Nodes: circles sized by connection count (8px to 24px radius)
5. Node colors by content type: essays = terracotta, field notes = teal, projects = gold, shelf = green
6. Node labels: Courier Prime 9px, uppercase, truncated to 20 chars
7. Edges: rough.js hand-drawn lines (roughness 1.5, stroke 0.5px, color `--color-border`)
8. Edge thickness: 0.5px (weak) to 1.5px (strong: 3+ shared tags)
9. Background: transparent (DotGrid shows through)
10. Interactions: click node -> navigate; hover node -> highlight edges, dim unconnected
11. Legend in bottom-right: color-to-type mapping, Courier Prime 9px
12. Min-height 500px, responsive width

**Acceptance criteria:**
- Force-directed graph renders with colored nodes for all published content
- Click navigates to content page
- Hover highlights connected edges
- Legend shows color mapping
- Transparent background (DotGrid visible)

**Gotchas:**
- Need to check if d3-force is already a dependency; if not, install it
- ConnectionEngine's `computeConnections` is per-essay; need to aggregate across all content
- rough.js canvas lines need their own canvas overlay or SVG approach

### Task 7.2: Create /connections route

**New file:** `src/app/connections/page.tsx`

**Steps:**
1. Server Component
2. Metadata: title "Connection Map", appropriate description
3. Render: SectionLabel ("Research Network", teal), heading with DrawOnIcon, description paragraph, `<ConnectionMap />`
4. Pre-compute connection data server-side, pass as props to ConnectionMap

**Acceptance criteria:**
- `/connections` route renders with full connection visualization
- Page metadata set correctly
- SectionLabel and heading match site conventions

### Task 7.3: Add footer link to ConnectionMap

**File:** `src/components/Footer.tsx`

**Steps:**
1. Import `GitBranch` from `@phosphor-icons/react/dist/ssr`
2. Add link: "Connection Map" with GitBranch icon, href `/connections`
3. Style: match existing footer link patterns

**Note:** NOT added to main nav (discovery/exploration tool only)

**Acceptance criteria:**
- Footer shows "Connection Map" link with GitBranch icon
- Link routes to `/connections`
- TopNav unchanged

---

## Phase 8: ProgressTracker Micro-Interactions

### Task 8.1: Add stamp animation to ProgressTracker

**File:** `src/components/ProgressTracker.tsx`

**Steps:**
1. Add optional prop: `lastAdvanced?: string` (ISO date string)
2. If `lastAdvanced` is within last 24 hours, add class `just-stamped` to current stage dot
3. CSS `@keyframes stamp`:
   - 0%: scale(1), rotate(0)
   - 30%: scale(1.3), rotate(3deg), full opacity color
   - 60%: scale(0.95), rotate(-1deg)
   - 100%: scale(1), rotate(0), normal opacity
4. JS scatter effect: 3-4 micro-dots (2px) that scatter outward 8-12px at random angles, fading over 400ms
   - Use absolute-positioned `<span>` elements
   - `useEffect` spawns them, `setTimeout` removes them after animation
5. Animation plays exactly once (CSS `animation-iteration-count: 1`, `animation-fill-mode: forwards`)
6. `prefers-reduced-motion`: skip animation, render dot in final state

**File:** `src/app/page.tsx` (and essay detail pages)

**Steps:**
1. If content has `lastAdvanced` in frontmatter, pass it to `<ProgressTracker>`
2. If field not present, omit prop (animation won't fire)

**Acceptance criteria:**
- When `lastAdvanced` is within 24 hours: brief stamp animation on page load
- Scatter dots appear and fade
- Otherwise renders normally (no animation)
- Reduced motion: no animation

**Gotchas:**
- ProgressTracker is currently a Server Component; stamp animation requires client-side JS
- May need to split: Server Component wrapper with Client Component for the animated dot
- Or convert entire ProgressTracker to Client Component (simpler but increases JS bundle)

---

## Execution Order & Review Checkpoints

| Batch | Phases | Review checkpoint |
|-------|--------|-------------------|
| 1 | Phase 1 (fonts) + Phase 4 (nav rename) | Build passes, fonts load, nav shows new label |
| 2 | Phase 2 (hero restructure) | Homepage hero renders correctly with pipeline counter |
| 3 | Phase 3 (code comments) | Homepage uses CodeComment, essay pages still use RoughCallout |
| 4 | Phase 5 (cursor states) | Reading line, crosshair, ink trail all working |
| 5 | Phase 6 (parallax) | Projects page has subtle depth effect |
| 6 | Phase 7 (ConnectionMap) | /connections page renders force graph |
| 7 | Phase 8 (stamp animation) | ProgressTracker animates on recent stage changes |

Each batch ends with `npm run build` verification. Visual verification via dev server after each batch.

---

## Dependencies to Install

Check if these are already in `package.json` before installing:
- `d3-force` (for ConnectionMap force simulation)
- `@types/d3-force` (TypeScript types)
- No other new dependencies needed (rough.js, Radix, Phosphor already present)

## Files Summary

**New files (5):**
- `src/components/PipelineCounter.tsx`
- `src/components/CodeComment.tsx`
- `src/components/ParallaxStack.tsx`
- `src/components/ConnectionMap.tsx`
- `src/app/connections/page.tsx`

**Modified files (10):**
- `src/app/fonts.ts`
- `src/styles/global.css`
- `src/components/CollageHero.tsx`
- `src/app/page.tsx`
- `src/components/TopNav.tsx`
- `src/components/ArticleBody.tsx`
- `src/components/DotGrid.tsx`
- `src/components/ProgressTracker.tsx`
- `src/components/Footer.tsx`
- `src/config/site.json`
