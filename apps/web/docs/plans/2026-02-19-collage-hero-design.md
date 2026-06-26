# Collage Hero + Editorial Essay Headers Design

**Date:** 2026-02-19
**Status:** In Progress
**Inspired by:** Blake Cale editorial collage illustration (Harper's/Atlantic style)

## Concept

Transform the homepage hero and essay headers into editorial, magazine-feature moments:
- **Homepage hero**: Full-bleed dark ground with curated collage of photographed desk objects, light typography (name + tagline) laid directly over the composition
- **Essay headers**: Full-bleed PatternImage or YouTube thumbnail with dark overlay, large uncontained title in cream
- **DotGrid**: Adapts to context (cream dots over dark hero, dark dots over parchment below)

The collage aesthetic introduces layered visual fragments and uncontained typography to the site's existing studio-journal identity. Cards below the fold remain unchanged.

## Aesthetic Goals

1. **Tactile density**: layered fragments you want to reach out and touch
2. **Uncontained typography**: text lives in the composition, not boxed up
3. **Intellectual tension**: eclectic mix of references (books, tools, electronics, photos)
4. **Geometric accents**: circles, lines, shapes as supporting visual punctuation

## Design Decisions

### Homepage Hero (CollageHero)

- Full-bleed dark ground (`#2A2824`, warm charcoal close to existing `--color-ink`)
- Individual desk objects photographed as separate PNGs with transparency, layered via CSS absolute positioning, transforms (rotation, scale), z-index, and drop shadows
- Name in Amarna (cream `#F0EBE4`) at significantly larger scale than current
- CyclingTagline below in matching light color
- NowPreview repositioned within the hero (semi-transparent over dark ground, or below the fold)
- Content counters in cream monospace
- Soft gradient transition to parchment below

**Desk items for collage fragments** (stored in `public/collage/`):
- *The Art of Doing Science and Engineering* (Hamming)
- *The Poetics of Space* (Bachelard)
- Flow Trip magazine (Wales issue)
- The New Yorker (an issue)
- Coffee mugs
- *The Utopia of Rules* (Graeber)
- Camera
- Raspberry Pi
- Laptop
- Sketchbook
- Journaling notebook
- Glasses with fancy cleaner
- *Strategic Project Management Made Simple* (Schmidt)
- HOTO home repair toolkit
- Photo with John and Hank Green

### DotGrid Dual-Color Adaptation

- DotGrid receives a `heroHeight` prop (or reads from CSS custom property)
- In the draw loop, dots above `heroHeight` render in cream (`#F0EBE4`) at ~40% reduced opacity
- Dots below render in current dark color
- 50px crossfade band at the boundary for smooth transition
- Spring physics and interaction behavior unchanged
- Performance impact: one conditional per dot per frame (negligible)

### Essay Headers (EssayHero)

**Phase 1 (ship now): Editorial Typography**
- PatternImage or YouTube thumbnail expands to full viewport width
- Dark overlay (warm charcoal at ~70% opacity) sits on top
- Title in Vollkorn, cream colored, 3rem to 4rem on desktop, positioned lower-left
- Date, reading time, ProgressTracker in cream monospace below title
- DotGrid renders cream dots over this zone too
- Below the header, soft edge transitions back to parchment
- Prose body begins in familiar `max-w-4xl` column

**Phase 2 (future): Fragment Library**
- Photograph 15 to 20 texture/object fragments as PNGs in `public/collage/`
- `CollageHeader` component selects 3 to 5 fragments based on essay slug seed
- CSS absolute positioning, random rotations (+-5 degrees), varying scales, z-index layering
- Optional `collageFragments` frontmatter array for per-essay overrides
- PatternImage can remain as one background layer beneath photographic fragments

## Technical Architecture

### New Components

| Component | Type | File |
|-----------|------|------|
| `CollageHero` | Client Component | `src/components/CollageHero.tsx` |
| `EssayHero` | Client Component | `src/components/EssayHero.tsx` |

### Modified Components

| Component | Change |
|-----------|--------|
| `DotGrid` | Add `heroHeight` prop; dual-color rendering in draw loop |
| `src/app/page.tsx` | Replace current hero section with `CollageHero` |
| `src/app/essays/[slug]/page.tsx` | Replace header with `EssayHero` |
| `src/app/layout.tsx` | Pass `heroHeight` to DotGrid via CSS custom property |
| `src/styles/global.css` | Add hero design tokens |

### New Design Tokens (global.css)

```css
/* Hero: Dark Collage Ground */
--color-hero-ground: #2A2824;
--color-hero-text: #F0EBE4;
--color-hero-text-muted: rgba(240, 235, 228, 0.7);
--color-hero-overlay: rgba(42, 40, 36, 0.70);
```

### New Assets Directory

`public/collage/` for photographed desk item PNGs (initially empty, populated as photos are taken)

### What is NOT Changing

- RoughBox card system below the fold
- Section color language (terracotta/teal/gold)
- Font system (all 7 fonts stay)
- Content pipeline (gray-matter + remark + Zod)
- Footer, TopNav structure
- PatternImage component itself
- Mobile card layouts

## Implementation Order

1. Design tokens + CSS utilities for hero system
2. DotGrid dual-color adaptation
3. CollageHero component (dark ground + light typography; fragments added as photos arrive)
4. Homepage integration (replace current hero with CollageHero)
5. EssayHero component (full-bleed image + dark overlay + editorial title)
6. Essay page integration (replace current header with EssayHero)
7. Transition polish (gradient fades between dark and parchment zones)
