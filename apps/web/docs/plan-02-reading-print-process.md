# Reading Environment, Print Stylesheet, Cognitive Anchoring & Process Proof

> **For Claude Code:** Execute tasks sequentially. Each task has exact file paths, code changes, and verification steps.
> **Branch:** `feature/reading-environment`
> **Depends on:** Nothing (standalone, but pairs well with Plan 01)

---

## Context

This plan transforms the reading experience for essays, field notes, and all long-form content. It covers typography refinements for readability, scroll-driven margin annotations (handwritten style, right margin) with research-note dropdowns from ConnectionDots (left margin), a "Document Stamp" toolbar for print/share/copy, a full print stylesheet, cognitive anchoring in essay headers, and a "Process Notes" section showing iteration metrics as social proof.

**Brand reference:** See `/CLAUDE.md` for design language. Typography system "The Documentarian" is primary for reading: Vollkorn 700 headings, Cabin 400 body, Courier Prime labels.

**Key constraint from Travis:** Headings are always Vollkorn, never monospace. Monospace (Courier Prime) is for labels and metadata only. Subtitles depending on content use Cabin or IBM Plex Sans.

---

## Phase 1: Typography Refinements for Reading

### Task 1.1: Enhance prose typography in global CSS

**File:** `src/styles/global.css`

Add or update the `.prose` class styles. These apply to all essay and field note body content rendered through `ArticleBody.tsx`.

**Specs (all from CLAUDE.md, with readability enhancements):**

```css
.prose {
  font-family: var(--font-body); /* Cabin 400 */
  font-size: 17px;
  line-height: 1.75;
  max-width: 65ch;
  color: var(--color-text-muted); /* #6A5E52, slightly softer than heading ink */
}

/* Headings: Vollkorn 700, never italic */
.prose h2 {
  font-family: var(--font-title); /* Vollkorn */
  font-weight: 700;
  font-size: 26px;
  line-height: 1.2;
  color: var(--color-text); /* #2A2420 */
  margin-top: 2.5em;
  margin-bottom: 0.75em;
}

.prose h3 {
  font-family: var(--font-title);
  font-weight: 700;
  font-size: 21px;
  line-height: 1.3;
  color: var(--color-text);
  margin-top: 2em;
  margin-bottom: 0.5em;
}

/* Subtitles / H4: IBM Plex Sans for structural contrast */
.prose h4 {
  font-family: var(--font-body-alt); /* IBM Plex Sans */
  font-weight: 600;
  font-size: 17px;
  line-height: 1.4;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

/* Paragraph spacing: logical grouping */
.prose p + p {
  margin-top: 1.25em; /* standard */
}
.prose h2 + p,
.prose h3 + p,
.prose blockquote + p {
  margin-top: 1.5em; /* slightly more after section breaks */
}

/* Blockquotes: hang into left margin for optical alignment */
.prose blockquote {
  margin-left: -1em;
  padding-left: 1em;
  border-left: 3px solid var(--color-accent); /* terracotta accent bar */
  font-family: var(--font-body-alt); /* IBM Plex Sans for voice shift */
  font-style: italic;
  color: var(--color-text-muted);
}

/* Figure captions: monospace metadata style */
.prose figcaption {
  font-family: var(--font-mono); /* Courier Prime */
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-light);
  margin-top: 0.5em;
}

/* Links within prose: terracotta, no underline, border-bottom on hover */
.prose a {
  color: var(--color-accent);
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 200ms ease;
}
.prose a:hover {
  border-bottom-color: var(--color-accent);
}

/* Code blocks in prose */
.prose code {
  font-family: var(--font-code, var(--font-mono));
  font-size: 0.9em;
  background: var(--color-bg-alt);
  padding: 0.15em 0.35em;
  border-radius: 3px;
}

.prose pre {
  background: var(--color-dark);
  color: var(--color-dark-text, #E8E0D6);
  padding: 1.25em 1.5em;
  border-radius: 6px;
  overflow-x: auto;
  font-family: var(--font-code, var(--font-mono));
  font-size: 14px;
  line-height: 1.6;
}
```

**Verification:** Open any essay page. Body text is Cabin 17px. Headings are Vollkorn bold. Blockquotes hang slightly left with terracotta border. Figure captions are Courier Prime uppercase.

---

## Phase 2: Scroll-Driven Margin Annotations

### Task 2.1: Create ScrollAnnotation component

**New file:** `src/components/ScrollAnnotation.tsx`

Handwritten-style margin annotations that appear as the reader scrolls past their target paragraph. Positioned in the RIGHT margin (left margin is reserved for ConnectionDots/research notes).

**Props:**
```typescript
interface ScrollAnnotationProps {
  /** Paragraph index (1-based) this annotation targets */
  paragraph: number;
  /** Annotation text */
  text: string;
  /** Section color tint */
  tint?: 'terracotta' | 'teal' | 'gold';
  /** rough.js seed for deterministic leader line */
  seed?: number;
}
```

**Behavior:**
- Uses IntersectionObserver on the target paragraph (selected via `#article-prose p:nth-of-type(${paragraph})`)
- Threshold: 0.3 (triggers when 30% of the paragraph is visible)
- Once triggered, the annotation fades in (opacity 0 to 1 over 300ms) and a rough.js leader line draws itself via stroke-dashoffset animation (600ms)
- Once visible, the annotation STAYS visible (no re-hiding on scroll past). This creates a progressive accumulation effect.
- Desktop (lg+): positioned absolute in the right margin, connected by a horizontal rough.js leader line from the paragraph's right edge
- Mobile: appears as an expandable inline callout below the target paragraph, triggered by a small NotePencil Phosphor icon (16px, thin weight) in the right gutter
- Typography: `--font-annotation` (Caveat), 15px, section tint color at 0.8 opacity (handwritten style, same as existing RoughCallout in reading pages)
- Leader line: rough.js horizontal line, roughness 1.5, strokeWidth 0.8, tint color

**Stacking:** Multiple annotations in the right margin stack vertically with 16px gap. If annotations would overlap (target paragraphs are close together), offset the later one downward.

### Task 2.2: Create ResearchDropdown for ConnectionDots (left margin)

**File:** `src/components/ConnectionDots.tsx` (modify existing)

Currently, ConnectionDots shows connection indicators in the left margin. Extend it to support an optional research-notes dropdown.

**New behavior:**
- Each connection dot, when clicked or hovered, can show a small dropdown panel
- The dropdown contains research notes specific to that paragraph, pulled from a new optional frontmatter field: `researchNotes` (array of `{paragraph: number, notes: string[]}`)
- Dropdown panel specs:
  - Background: `--color-surface` with `backdrop-filter: blur(4px)` (frosted glass per brand spec)
  - Border: 1px solid `--color-border-light`
  - Padding: 8px 12px
  - Max width: 280px
  - Typography: IBM Plex Sans 13px for note text, Courier Prime 9px uppercase for "RESEARCH NOTE" label
  - Positioned below the dot, left-aligned with the margin
  - Closes on click outside or scroll past
- If no `researchNotes` are defined for a paragraph, the ConnectionDot behaves as it currently does (no dropdown, just the visual connection indicator)

**Frontmatter schema update needed in `src/lib/content.ts`:**
Add optional `researchNotes` field to the essay schema:
```typescript
researchNotes: z.array(z.object({
  paragraph: z.number(),
  notes: z.array(z.string()),
})).optional(),
```

### Task 2.3: Create AnnotatedArticle wrapper

**New file:** `src/components/AnnotatedArticle.tsx`

A wrapper component that combines `ArticleBody`, `ScrollAnnotation` instances, and the enhanced `ConnectionDots` into a unified reading layout.

**Layout (desktop lg+):**
```
[LEFT MARGIN: ConnectionDots + ResearchDropdowns] | [PROSE CONTENT] | [RIGHT MARGIN: ScrollAnnotations]
```

**Layout (mobile):**
```
[PROSE CONTENT with inline annotation triggers and connection indicators]
```

**Props:**
```typescript
interface AnnotatedArticleProps {
  html: string;
  contentType: ContentType;
  articleSlug: string;
  annotations?: Array<{ paragraph: number; text: string }>;
  researchNotes?: Array<{ paragraph: number; notes: string[] }>;
  positionedConnections?: PositionedConnection[];
  tint?: 'terracotta' | 'teal' | 'gold';
}
```

**Implementation:**
- Renders a three-column CSS grid on desktop: `minmax(0, 1fr) minmax(0, 65ch) minmax(0, 1fr)`
- Left column: ConnectionDots with research dropdowns
- Center column: ArticleBody prose
- Right column: ScrollAnnotation instances
- On mobile: single column, annotations and connections collapse to inline

### Task 2.4: Use AnnotatedArticle in essay detail pages

**File:** `src/app/essays/[slug]/page.tsx`

Replace the current `ArticleBody` usage with `AnnotatedArticle`, passing in annotations from frontmatter, research notes if present, and positioned connections.

**Verification:** Open an essay with annotations defined in frontmatter. Scroll through. Right margin annotations fade in progressively as their target paragraphs enter view. Left margin connection dots show research note dropdowns when clicked (if research notes are defined). On mobile, both collapse to inline.

---

## Phase 3: Document Stamp Toolbar

### Task 3.1: Create DocumentStamp component

**New file:** `src/components/DocumentStamp.tsx`

A circular stamp button styled like a patent-office seal. Used for Print, Share, and Copy Link actions.

**Visual specs per stamp:**
- Circular container: 48px diameter, border 1.5px solid `--color-border`, border-radius 50%
- Center: Phosphor icon (20px, thin weight)
  - Print: `Printer` icon
  - Share: `ShareNetwork` icon
  - Copy: `Link` icon
- Rim text: around the circle's perimeter, Courier Prime 7px uppercase, letter-spacing 0.15em
  - Print: "PRINT THIS DOCUMENT"
  - Share: "SHARE"
  - Copy: "COPY LINK"
- Rim text rendered via SVG `<textPath>` on a circular `<path>`, color `--color-text-light`
- Background: `--color-surface` at 0.9 opacity with backdrop-filter blur(2px)
- Hover state: border color shifts to `--color-accent`, icon color shifts to `--color-accent`, subtle scale(1.05)
- Click animation: scale(0.95) for 100ms, then back to scale(1), brief background flash to `--color-accent` at 0.1 opacity
- Active/pressed state: `--color-accent` border

### Task 3.2: Create StampToolbar component

**New file:** `src/components/StampToolbar.tsx`

Groups the three DocumentStamp buttons into a vertical toolbar.

**Desktop (lg+):** Fixed position in the right margin, vertically centered relative to viewport. Stacked vertically with 12px gap. Positioned at `right: calc((100vw - 65ch) / 4)` to sit in the margin space.

**Mobile:** Sticky bottom bar, horizontal layout, 8px gap, with a frosted glass background bar. Shows only icons (no rim text) at 36px diameter to save space.

**Actions:**
- Print: calls `window.print()`. The print stylesheet (Phase 4) handles the formatting.
- Share: uses `navigator.share()` if available (mobile), falls back to copying URL to clipboard with a brief "Copied!" toast
- Copy Link: copies `window.location.href` to clipboard, shows brief "Copied!" toast (2s, bottom-right, Courier Prime 11px, `--color-surface` background)

**Show/hide logic:** The toolbar appears after the user scrolls past the essay hero (use IntersectionObserver on the hero element; when hero exits viewport, show toolbar). Hides when user scrolls back to the top.

### Task 3.3: Add StampToolbar to essay detail pages

**File:** `src/app/essays/[slug]/page.tsx`

Add `<StampToolbar />` after the `<AnnotatedArticle />` component (it positions itself with fixed/sticky CSS, so DOM order doesn't affect layout).

**Verification:** Scroll past the essay hero. Three circular stamp buttons appear in the right margin (desktop) or bottom bar (mobile). Click Print and the print dialog opens. Click Share/Copy and the URL copies to clipboard.

---

## Phase 4: Print Stylesheet

### Task 4.1: Create print styles

**New file:** `src/styles/print.css` (imported in `global.css` via `@import './print.css' print;` or via `@media print` block)

**Elements to hide in print:**
- TopNav (`nav[aria-label="Main navigation"]`)
- Footer
- DotGrid canvas
- StampToolbar
- ScrollAnnotation leader line canvases (keep annotation text, reposition as footnotes)
- ConnectionDots
- ThemeToggle
- All interactive hover/focus states
- All easter egg components

**Page frame:**
```css
@page {
  margin: 0.75in;
  size: letter;
}

body::before {
  content: '';
  position: fixed;
  inset: 0.5in;
  border: 0.5px solid #2A2420;
  border-width: 0.5px;
  pointer-events: none;
  z-index: 9999;
}

/* Registration/crop marks at corners */
body::after {
  content: '';
  position: fixed;
  /* Four corner marks using background-image with linear-gradients */
  /* Each mark: 12px lines forming an L at each corner */
}
```

**Typography for print:**
```css
@media print {
  .prose {
    font-family: 'Cabin', sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #2A2420;
    max-width: none; /* fill the print area */
  }

  .prose h1, .prose h2, .prose h3 {
    font-family: 'Vollkorn', serif;
    font-weight: 700;
    color: #2A2420;
    page-break-after: avoid;
  }

  .prose h2 {
    font-variant: small-caps;
    font-size: 14pt;
  }

  .prose h3 {
    font-variant: small-caps;
    font-size: 12pt;
  }

  /* Monospace labels */
  .font-mono, [class*="font-mono"] {
    font-family: 'Courier Prime', monospace;
  }

  /* Accent color maps to medium gray for print */
  .text-terracotta,
  [style*="color: var(--color-terracotta)"],
  [style*="color: var(--color-accent)"] {
    color: #666 !important;
  }
}
```

**Margin annotations become footnotes:**
```css
@media print {
  /* Hide the positioned margin annotations */
  .scroll-annotation-desktop { display: none; }

  /* Show a print-specific footnotes section */
  .print-footnotes { display: block; }
}
```

The `AnnotatedArticle` component should render a hidden `<div class="print-footnotes">` at the bottom of the article containing all annotations as numbered footnotes. In the prose, each annotated paragraph gets a superscript number injected. This section is `display: none` in screen CSS and `display: block` in print CSS.

**Colophon block at page bottom:**
```css
.print-colophon {
  display: none;
}

@media print {
  .print-colophon {
    display: block;
    margin-top: 2em;
    padding-top: 1em;
    border-top: 0.5px solid #2A2420;
    font-family: 'Courier Prime', monospace;
    font-size: 8pt;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
}
```

Colophon content: `travisgilbert.me/essays/{slug} | Printed {date} | Travis Gilbert`

### Task 4.2: Add print colophon and footnotes to AnnotatedArticle

**File:** `src/components/AnnotatedArticle.tsx`

At the bottom of the component, render:
1. A `<div className="print-footnotes">` containing all annotations as a numbered list
2. A `<div className="print-colophon">` with the URL, print date (via client-side JS on print event), and author name

**Verification:** Click Print (or Cmd+P). The print preview shows: bordered page with crop marks, Vollkorn small-caps headings, Cabin body, annotations as numbered footnotes at the bottom, colophon with URL and date. No nav, no DotGrid, no interactive elements.

---

## Phase 5: Cognitive Anchoring in Essay Headers

### Task 5.1: Add thesis and source count to EssayHero

**File:** `src/components/EssayHero.tsx`

Add two new optional props:

```typescript
interface EssayHeroProps {
  // ... existing props ...
  /** One-sentence thesis statement */
  thesis?: string;
  /** Number of sources referenced */
  sourceCount?: number;
}
```

**Thesis rendering:**
- Positioned between `summary` and `tags` in the hero
- IBM Plex Sans 400 italic, 16px, color `--color-hero-text-muted`
- Left border: 3px solid `--color-terracotta-light` (the accent bar pattern from CLAUDE.md)
- Padding-left: 12px
- Max-width: `55ch` (tighter than body for visual emphasis)

**Source count rendering:**
- Positioned next to the existing reading time metadata (top-right corner area)
- Same style as reading time: Courier Prime 9px, uppercase, letter-spacing 0.08em, hero text muted color
- Text: "Based on {N} sources" or just "{N} sources"
- Only renders if `sourceCount` is provided and > 0

### Task 5.2: Add frontmatter fields

**File:** `src/lib/content.ts`

Add to the essay Zod schema:
```typescript
thesis: z.string().optional(),
sourceCount: z.number().optional(),
```

### Task 5.3: Pass new fields in essay detail page

**File:** `src/app/essays/[slug]/page.tsx`

Read `thesis` and `sourceCount` from the essay data and pass to `EssayHero`.

If `sourceCount` is not in frontmatter but the essay has a `sources` array, automatically compute it: `sourceCount={essay.data.sources?.length ?? essay.data.sourceCount}`.

**Verification:** An essay with `thesis: "Parking minimums are a hidden tax on housing affordability"` and `sourceCount: 14` shows the thesis in italic with a terracotta left bar, and "BASED ON 14 SOURCES" next to the reading time.

---

## Phase 6: Process Proof (Social Proof Through Process)

### Task 6.1: Create ProcessNotes component

**New file:** `src/components/ProcessNotes.tsx`

A section at the bottom of each essay showing iteration metrics and research provenance. Styled as a `RoughBox` with Courier Prime labels.

**Data inputs (all optional, from frontmatter or computed):**
```typescript
interface ProcessNotesProps {
  /** Date research began */
  researchStarted?: Date;
  /** Date published */
  publishedDate?: Date;
  /** Number of sources by type */
  sourceSummary?: string; // e.g. "3 books, 5 articles, 2 datasets"
  /** Number of revisions (from Django PublishLog, passed via frontmatter or API) */
  revisionCount?: number;
  /** Number of connected content pieces */
  connectionCount?: number;
  /** Content types connected to */
  connectedTypes?: string; // e.g. "3 field notes, 2 projects"
  /** Section color */
  tint?: 'terracotta' | 'teal' | 'gold';
}
```

**Visual design:**
- Wrapped in `<RoughBox tint={tint} padding={20}>`
- Header: "PROCESS NOTES" in Courier Prime 10px, uppercase, letter-spacing 0.12em, tint color
- Horizontal rule: `<RoughLine>` (thin, no label)
- Metrics laid out as a 2-column grid of key-value pairs:
  - "Research duration": computed from `researchStarted` to `publishedDate`, displayed as "Researched over 4 months"
  - "Sources": the `sourceSummary` string
  - "Revisions": `revisionCount` + "revisions" (e.g. "12 revisions")
  - "Connections": `connectedTypes` string
- Keys: Courier Prime 9px, uppercase, tint color at 0.6 opacity
- Values: Cabin 15px, `--color-text`
- Only show metrics that have data (skip any undefined/null fields)
- If ALL fields are empty, don't render the component at all

### Task 6.2: Create PublicationGraph component

**New file:** `src/components/PublicationGraph.tsx`

A small, subtle visualization showing publishing activity over time. NOT a rate chart (which could backfire during slow periods), but a cumulative "things I've made" counter with a sparkline.

**Design:**
- Small: max 200px wide, 60px tall
- Shows a cumulative step chart: each publication adds a step upward
- X-axis: time (months, last 12 months)
- Y-axis: cumulative count of published items (essays + field notes + projects)
- Line: 1.5px, tint color
- Dots at each publication: 3px circles, tint color
- Below the chart: "N pieces published" in Courier Prime 9px uppercase
- Rendered with SVG (no D3 dependency, simple enough for hand-built SVG)
- The chart only goes UP (cumulative), so it always looks like progress even during slow periods

**Data source:** Reads from `getCollection()` at build time, sorts all published content by date, computes cumulative count.

### Task 6.3: Add ProcessNotes and PublicationGraph to essay layout

**File:** `src/app/essays/[slug]/page.tsx`

After the `AnnotatedArticle` and before the comments section:
1. Render `<ProcessNotes>` with available data from the essay frontmatter
2. Render `<PublicationGraph>` as a small element within or beside the ProcessNotes box

**Frontmatter additions needed in `src/lib/content.ts`:**
```typescript
researchStarted: z.coerce.date().optional(),
revisionCount: z.number().optional(),
```

The `connectionCount` and `connectedTypes` can be computed at build time from the connection engine rather than stored in frontmatter.

### Task 6.4: Add a site-wide iteration counter to the /now page

**File:** `src/app/now/page.tsx`

Add a "Scorecard" section to the /now page that shows:
- Total published pieces (all time)
- Total connections between content
- Total revisions across all content
- The PublicationGraph sparkline
- Framed as: "Proof that I do things" (or similar self-aware label, Travis can customize the copy)

This serves Travis's stated goal of using the site as motivation to track that he does, in fact, produce things.

**Verification:** Essay pages show a "Process Notes" box at the bottom with research duration, source count, revision count, and connections. The /now page shows a cumulative scorecard. The publication graph shows an upward-stepping line.

---

## Summary of New/Modified Files

**New files:**
- `src/components/ScrollAnnotation.tsx`
- `src/components/AnnotatedArticle.tsx`
- `src/components/DocumentStamp.tsx`
- `src/components/StampToolbar.tsx`
- `src/components/ProcessNotes.tsx`
- `src/components/PublicationGraph.tsx`
- `src/styles/print.css`

**Modified files:**
- `src/styles/global.css` (prose typography, print import)
- `src/components/ConnectionDots.tsx` (research note dropdowns)
- `src/components/EssayHero.tsx` (thesis, source count)
- `src/lib/content.ts` (new frontmatter fields: thesis, sourceCount, researchStarted, revisionCount, researchNotes)
- `src/app/essays/[slug]/page.tsx` (AnnotatedArticle, StampToolbar, ProcessNotes, cognitive anchoring props)
- `src/app/now/page.tsx` (scorecard section)
