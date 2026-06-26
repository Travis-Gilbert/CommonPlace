# Collage Hero Design Spec: Implementation Plan

**Source**: `collage-hero-design-spec (1).md`
**Status**: Gap analysis against existing codebase

## Assessment: Mostly Implemented

After reading every file referenced in the design spec, **~90% of the work is already done**. The codebase already has:

- CollageHero component with fragments, dark ground, grain, typography, breakout layout, ResizeObserver
- EssayHero component with YouTube/PatternImage background, dark overlay, editorial typography
- DotGrid zone-aware dual-color rendering with hero height CSS property, scroll listener, crossfade band
- `inverted` prop on CyclingTagline, NowPreviewCompact, TagList, ProgressTracker (all four)
- Hero design tokens in global.css (`--color-hero-ground`, `--color-hero-text`, etc.)
- `--main-pad-y` custom property on `.main-content` with responsive breakpoint
- `.hero-fade-to-parchment` utility class
- Homepage integration: CollageHero with slots for CyclingTagline and NowPreviewCompact
- Essay detail integration: EssayHero with inverted TagList and ProgressTracker slots
- `public/collage/` directory with 4 fragment images
- Clean production build (no errors)

## Remaining Gaps

### Batch 1: CLAUDE.md Updates (Documentation)

These are from the audit performed before the spec was loaded:

1. **Add undocumented Client Components to Server vs Client table**
   - CollageHero, EssayHero, ArticleBody, ArticleComments, CommentForm, StickyNote, StickyNoteLayer, MobileCommentList, ReadingProgress, NowPreviewCompact
   - Files: `CLAUDE.md`

2. **Add undocumented lib files and API routes**
   - `src/lib/comments.ts`, `src/lib/paragraphPositions.ts`, `src/lib/recaptcha.ts`
   - `src/app/api/comments/route.ts`, `src/app/api/comments/[id]/flag/route.ts`
   - Files: `CLAUDE.md`

3. **Add `npm install` to Development Commands**
   - Files: `CLAUDE.md`

4. **Trim Recent Decisions from 30 to ~20**
   - Graduate implementation-detail entries to the record doc or remove stale ones
   - Files: `CLAUDE.md`

5. **Move completed Phase tables out**
   - Replace 4 Phase status tables (~80 lines) with a summary line and reference to `docs/records/001-site-wide-redesign.md`
   - Files: `CLAUDE.md`

### Batch 2: Spec Compliance Verification

Cross-check each spec requirement against the implementation:

6. **Verify CollageHero matches spec exactly**
   - Props interface: spec says `{name, tagline, nowPreview}` but implementation has `{name, countersLabel, tagline, nowPreview}`. The `countersLabel` prop is an addition beyond the spec (content counters line). This is fine as additive.
   - Layout: spec says `3-column grid (1fr 118px 1fr)` matching RoughLine label. Implementation uses this grid.
   - Typography: spec says Vollkorn 700. Implementation uses `--font-name` (Amarna). Need to verify this is intentional.
   - Fragment layer: 4 fragments defined and rendering.
   - Transition: bottom gradient matches spec's multi-stop pattern.
   - Status: **Likely complete, verify font choice with user**

7. **Verify EssayHero matches spec**
   - Background: YouTube thumbnail via `<img>` (spec says `next/image`). Consider upgrading.
   - Dark overlay: present.
   - Typography: title, date, reading time, summary, tags, progress tracker all present.
   - Category label: spec mentions "Courier Prime, 11px, uppercase, terracotta, above title with short rule". Not present in current implementation.
   - Date placement: spec says "top-right corner". Implementation has it in a flex row above the title (left-aligned).
   - Status: **Minor deviations from spec to review**

8. **Verify DotGrid zone awareness**
   - Hero dot color constants match spec: `[240, 235, 228]` at 35%, crossfade band 50px.
   - Scroll listener redraws static dots on scroll.
   - Status: **Complete**

9. **Verify inverted props on 4 components**
   - CyclingTagline: prefix uses `--color-hero-text-muted`, topic uses `--color-terracotta-light`, cursor uses `--color-terracotta-light`. Matches spec.
   - NowPreviewCompact: border uses `rgba(240,235,228,0.15)`, header uses `--color-hero-text-muted`, values use `--color-hero-text`. Matches spec.
   - TagList: has `invertedTintStyles` record with all tint variants. Matches spec.
   - ProgressTracker: dots, connectors, labels all use inverted cream variants. Matches spec.
   - Status: **Complete**

10. **Verify page integrations**
    - Homepage: CollageHero integrated with inverted CyclingTagline and NowPreviewCompact. Complete.
    - Essay detail: EssayHero integrated with inverted TagList and ProgressTracker. YouTube embed below hero. Complete.
    - Status: **Complete**

11. **Verify layout/CSS changes**
    - `--main-pad-y` on `.main-content`: present in global.css. Layout uses `main-content` class.
    - Hero tokens in `@theme inline`: present.
    - `.hero-fade-to-parchment`: present.
    - Status: **Complete**

12. **Sitemap check**
    - Only one `sitemap.ts` at `src/app/sitemap.ts`. No stale root-level duplicate. Good.

### Batch 3: Polish and Build Verification

13. **EssayHero: consider `next/image` for YouTube thumbnail**
    - Currently uses `<img>`. Spec says `next/image` with `object-fit: cover`. Using `next/image` with `fill` prop would give automatic optimization.

14. **Run final production build**
    - `npm run build` to confirm no regressions.

## Implementation Order

1. Batch 1 (CLAUDE.md updates): tasks 1-5
2. Batch 2 (spec verification): tasks 6-12, noting deviations for user review
3. Batch 3 (polish): tasks 13-14

## Questions for User Before Proceeding

- **CollageHero font**: Spec says "Vollkorn 700" for the name, but implementation uses `--font-name` (Amarna). Is Amarna the intentional choice?
- **EssayHero category label**: Spec describes a "Category label: Courier Prime, 11px, uppercase, terracotta, above title with short rule". This isn't in the current implementation. Is it still desired?
- **EssayHero date placement**: Spec says "top-right corner". Implementation has it left-aligned above the title. Which is preferred?
- **EssayHero YouTube thumbnail**: Upgrade `<img>` to `next/image` for optimization, or keep simple `<img>` for fewer layout quirks?
