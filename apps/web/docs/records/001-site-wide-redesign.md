# Record 001: Site-Wide Redesign (Taxonomy + Homepage + New Components)

## Status

Designing

---

## Problem

The site has accumulated naming and structural debt from its origins as a video investigation platform. Three core issues:

1. **Misleading taxonomy**: "Investigations" implies investigative journalism. Travis writes essays about how design decisions shape human outcomes. The label is inaccurate and raises the bar for content that should feel essayistic, not forensic.

2. **Redundant content streams**: "Working Ideas" and "Field Notes" serve nearly identical purposes (shorter observations, developing thoughts). Two separate collections, routes, and schemas for content visitors cannot distinguish between.

3. **Missing lifecycle visibility**: Essays and notes go through stages (research, drafting, production, published) but the site shows no indication of where content sits in that lifecycle. This matters because the site's identity is "working in public."

Secondary issues: the hero counters compete with the tagline for attention, the footer is generic ("Built with Next.js & too much coffee"), project cards lack visual role differentiation, and there are no fallback images for content without YouTube thumbnails.

## Options Considered

### Option A: Incremental fixes
- Rename routes and schemas only.
- Add progress tracker to existing card designs.
- Keep Working Ideas as a separate collection.
- **Pros:** Smallest diff, lowest risk.
- **Cons:** Doesn't fix the structural redundancy. Working Ideas/Field Notes distinction remains confusing.

### Option B: Full taxonomy restructure + homepage redesign (spec approach)
- Rename investigations to essays throughout.
- Merge working-ideas into field-notes with `status` field.
- Rebuild homepage sections: featured essay with progress tracker, /now preview, role-icon project cards, asymmetric field notes grid.
- New components: ProgressTracker, PatternImage, CompactTracker, NowPreview.
- Footer links to colophon. Nav goes from 6 to 5 items.
- **Pros:** Fixes all three core problems. Coherent information architecture. Matches the prototype visual design.
- **Cons:** Large surface area. Touches 30+ files. Needs careful phasing to avoid breakage.

### Option C: Taxonomy rename + minimal UI
- Full rename (Option B taxonomy) but keep current homepage design.
- Add progress tracker only, skip PatternImage and /now.
- **Pros:** Gets the naming right without UI risk.
- **Cons:** Misses the visual improvements that make the redesign feel complete.

### Decision

**Option B**: Full taxonomy restructure + homepage redesign. The spec and prototype are well-defined; the prototype gives pixel-level guidance for every new component. Phasing the work into 4 sequential batches manages the risk: taxonomy rename first (everything depends on it), then homepage improvements, then new features, then advanced features.

## Solution

### Architecture: 4 Phases, Strict Ordering

**Phase 1: Taxonomy Rename** (everything depends on this)
- Rename `src/content/investigations/` to `src/content/essays/`
- Rename `src/app/investigations/` to `src/app/essays/`
- Merge 3 working-idea markdown files into `src/content/field-notes/` (update frontmatter)
- Delete `src/app/working-ideas/`
- Update `src/lib/content.ts`: rename schemas, types, collection names
- Update `src/app/page.tsx`: all investigation/working-idea references become essay/field-note
- Update `TopNav.tsx`: 5 nav items (Essays on.../Field Notes/Projects/Toolkit/Connect)
- Update `CyclingTagline.tsx`: "On..." prefix becomes "Essay on..."
- Update `global.css`: `.prose-investigations` becomes `.prose-essays`
- Update OG image, sitemap, RSS, tag pages
- Add Next.js redirect: `/investigations/*` to `/essays/*`
- Update content.ts schema: add `stage` to essays, add `status` to field notes, add `image` field

**Phase 2: Homepage Improvements** (depends on Phase 1)
- Demote hero counters from column layout to subtle inline text below tagline
- Build `ProgressTracker` component (full + compact variants)
- Build `PatternImage` component (generative canvas, seeded from slug)
- Add image support to featured essay card (YouTube > curated > generative fallback)
- Add progress tracker to featured essay card and essay listing cards
- Build project cards with role-specific SketchIcon glyphs in tinted containers
- Replace footer quip with colophon link
- Build `NowPreview` section (4-quadrant grid: researching/reading/building/listening)

**Phase 3: New Features** (depends on Phase 2)
- Add `status` field rendering on field note cards (compact tracker: observation/developing/connected)
- Build `/now` page with `src/content/now.md` data source
- Add SketchIcon draw-on animation (stroke-dasharray/dashoffset technique)
- Expand ConsoleEasterEgg

**Phase 4: Advanced** (independent, can be deferred)
- Margin annotations on essay detail pages (desktop: absolute position in page margins with leader lines; mobile: inline with left border accent)
- Custom remark plugin to parse `<!-- annotation: ... -->` from markdown
- Related content / connections between essays and field notes
- Dark mode

### Key Technical Decisions

1. **ProgressTracker is generic**: accepts `stages` array prop, works for both essay stages (4) and field note stages (3). Single component, two rendering modes (full with connecting lines + labels, compact dots-only with single label).

2. **PatternImage uses canvas**: seeded PRNG from slug generates topographic contour lines, dot fields, and organic curves. Section accent color tints the pattern. Warm parchment base (`--color-bg-alt`). Client Component (`'use client'`).

3. **Image system is 3-tier**: `youtubeId` frontmatter (existing) > `image` frontmatter (new path to `/public/images/`) > PatternImage fallback (generated). The featured card and listing cards both use this hierarchy.

4. **Working Ideas migration**: the 3 existing `.md` files move to `src/content/field-notes/`. Their `status` field maps: `seed` becomes `observation`, `growing` becomes `developing`, `pruning` becomes `connected`. The `featured` and `callouts` fields carry over to field note schema.

5. **Nav restructure**: 6 items to 5. "On ..." becomes "Essays on..." (with trailing ellipsis). "Working Ideas" removed. Order: Essays on.../Field Notes/Projects/Toolkit/Connect.

6. **Footer**: "Built with Next.js & too much coffee" becomes "How this site was built" linking to `/colophon`.

7. **Redirects**: `next.config.ts` gets `async redirects()` returning `/investigations/:path*` to `/essays/:path*` (permanent 308).

## User Stories

### Story 1: Taxonomy rename (investigations to essays)
**As a** visitor
**I want** content labeled as "essays" rather than "investigations"
**So that** the framing matches what the content actually is

**Acceptance Criteria:**
- [ ] `src/content/investigations/` renamed to `src/content/essays/`
- [ ] `src/app/investigations/` renamed to `src/app/essays/`
- [ ] `investigationSchema` renamed to `essaySchema` in content.ts
- [ ] `Investigation` type renamed to `Essay`
- [ ] `stage` field added to essay schema: `z.enum(['research', 'drafting', 'production', 'published']).default('published')`
- [ ] `image` field added to essay schema: `z.string().optional()`
- [ ] Collection name `'investigations'` updated to `'essays'` everywhere
- [ ] Homepage `page.tsx` uses `Essay` type and `/essays/` routes
- [ ] Global CSS `.prose-investigations` renamed to `.prose-essays`
- [ ] OG image, sitemap.ts, rss.xml/route.ts updated
- [ ] Existing investigation markdown files get `stage` frontmatter added
- [ ] `npm run build` passes with zero errors

**Priority:** Critical (Phase 1, blocks everything)
**Status:** Pending

### Story 2: Merge Working Ideas into Field Notes
**As a** visitor
**I want** a single "Field Notes" stream rather than two overlapping collections
**So that** I can find all shorter-form content in one place

**Acceptance Criteria:**
- [ ] 3 working-idea `.md` files migrated to `src/content/field-notes/` with updated frontmatter
- [ ] `status` field added to `fieldNoteSchema`: `z.enum(['observation', 'developing', 'connected']).default('observation')`
- [ ] `featured` and `callouts` fields added to `fieldNoteSchema`
- [ ] `workingIdeaSchema` removed from content.ts
- [ ] `WorkingIdea` type export removed
- [ ] `'working-ideas'` removed from `CollectionName` union
- [ ] `src/app/working-ideas/` directory deleted
- [ ] Homepage Working Ideas section removed, field notes section updated
- [ ] `npm run build` passes with zero errors

**Priority:** Critical (Phase 1, blocks homepage redesign)
**Status:** Pending

### Story 3: Navigation and CyclingTagline update
**As a** visitor
**I want** clear, accurate navigation labels
**So that** I know where each link leads

**Acceptance Criteria:**
- [ ] `TopNav.tsx` nav links: 5 items (Essays on.../Field Notes/Projects/Toolkit/Connect)
- [ ] `href` for essays is `/essays`
- [ ] Working Ideas nav item removed
- [ ] `CyclingTagline.tsx` prefix changed from "On..." to "Essay on..."
- [ ] Permanent redirect added: `/investigations/*` to `/essays/*`
- [ ] Nav SketchIcon for essays uses appropriate icon name

**Priority:** Critical (Phase 1)
**Status:** Pending

### Story 4: ProgressTracker component
**As a** visitor
**I want** to see where an essay or field note is in its lifecycle
**So that** I understand the site's "working in public" approach

**Acceptance Criteria:**
- [ ] `src/components/ProgressTracker.tsx` created
- [ ] Full variant: connected dots with labels, section-color coding, glow on current stage
- [ ] Compact variant: dots-only with single text label for current stage
- [ ] Generic `stages` prop accepts any array of `{key, label}` objects
- [ ] `currentStage` prop highlights correct dot
- [ ] `color` prop defaults to terracotta
- [ ] Works for essay stages (4: research/drafting/production/published)
- [ ] Works for field note stages (3: observation/developing/connected)
- [ ] Matches prototype visual design (dot sizes, font, spacing)
- [ ] Server Component (no animation needed for tracker itself)

**Priority:** High (Phase 2, needed for homepage cards)
**Status:** Pending

### Story 5: PatternImage generative fallback component
**As a** visitor
**I want** every essay card to have a visual header
**So that** the site feels visually complete even without curated photos

**Acceptance Criteria:**
- [ ] `src/components/PatternImage.tsx` created as Client Component (`'use client'`)
- [ ] Accepts `seed` (string), `height` (number, default 160), `color` (string, default terracotta)
- [ ] Generates deterministic pattern from seed (same seed = same pattern)
- [ ] Pattern includes: grid dots, organic curves, topographic contour lines
- [ ] Uses section accent color at low opacity
- [ ] Warm parchment base matching `--color-bg-alt`
- [ ] Canvas scales for devicePixelRatio (DPR)
- [ ] Matches prototype visual design

**Priority:** High (Phase 2)
**Status:** Pending

### Story 6: Homepage redesign (hero, featured card, sections)
**As a** visitor
**I want** a clear, well-organized homepage
**So that** I immediately understand what this site is about

**Acceptance Criteria:**
- [ ] Hero: counters demoted to subtle inline text below CyclingTagline (Courier Prime 11px, ink-light, uppercase)
- [ ] Featured essay card: shows PatternImage or YouTube thumbnail, ProgressTracker (full), date, title, summary, tags
- [ ] Secondary essay cards: show compact tracker, date, title, excerpt, tags
- [ ] Section order: Essays, /now preview, Projects, Field Notes
- [ ] Project cards: include role-specific SketchIcon glyph in tinted 36x36 container
- [ ] Field notes grid: asymmetric 3fr/2fr with staggered offset, compact tracker per card
- [ ] All "investigation" text and routes updated to "essay"
- [ ] Section dividers use RoughLine with appropriate label colors
- [ ] "All essays/projects/field notes" links point to correct routes

**Priority:** High (Phase 2)
**Status:** Pending

### Story 7: NowPreview section and /now page
**As a** visitor
**I want** to see what Travis is currently focused on
**So that** the site feels alive and regularly updated

**Acceptance Criteria:**
- [ ] `NowPreview` component: 4-quadrant grid (Researching/Reading/Building/Listening To)
- [ ] Labels in Courier Prime uppercase with section-specific colors (terracotta/teal/gold/olive)
- [ ] Content in Vollkorn 15px semibold
- [ ] Appears between Essays and Projects sections on homepage
- [ ] `/now` route created with full-page version
- [ ] Data source: `src/content/now.md` (single manually-updated file)
- [ ] Neutral tint card (RoughBox or simple Card wrapper)

**Priority:** Medium (Phase 2/3)
**Status:** Pending

### Story 8: Footer redesign
**As a** visitor
**I want** the footer to link to the colophon
**So that** I can learn how the site was built

**Acceptance Criteria:**
- [ ] "Built with Next.js & too much coffee" replaced
- [ ] New footer: `(c) 2026 Travis Gilbert    RSS | How this site was built ->`
- [ ] "How this site was built" links to `/colophon`
- [ ] "How this site was built" in terracotta color
- [ ] RSS link preserved
- [ ] Courier Prime mono styling maintained

**Priority:** Medium (Phase 2)
**Status:** Pending

### Story 9: SketchIcon draw-on animation
**As a** visitor
**I want** icons to animate their strokes on first appearance
**So that** the hand-drawn aesthetic feels alive

**Acceptance Criteria:**
- [ ] `stroke-dasharray` / `stroke-dashoffset` technique on SketchIcon paths
- [ ] 300-400ms duration, ease-out timing
- [ ] Triggered by IntersectionObserver on first viewport entry
- [ ] Animates once per page load only
- [ ] Works in nav icons and page header icons
- [ ] Does not break Server Component (may need wrapper Client Component)

**Priority:** Low (Phase 3)
**Status:** Pending

### Story 10: Margin annotations on essay detail pages
**As a** reader
**I want** handwritten-style margin notes alongside essay paragraphs
**So that** the reading experience feels like annotated research

**Acceptance Criteria:**
- [ ] Desktop (lg+): annotations absolutely positioned in page margins (-190px offset)
- [ ] Connected by hand-drawn leader line (horizontal + 45deg diagonal stub)
- [ ] Staggered on alternating sides
- [ ] Caveat font, 15px, section accent color, 85% opacity
- [ ] Mobile (below lg): collapse to inline blocks with 2px left border accent
- [ ] Triggered by `<!-- annotation: ... -->` HTML comments in markdown
- [ ] Custom remark plugin or post-processing to extract annotations

**Priority:** Low (Phase 4)
**Status:** Pending
