# Projects Page Redesign: Role-Based Column Layout

> **Date**: 2026-02-16
> **Status**: Designing
> **Spec**: `projects-page-redesign-spec (1).md`
> **Prototype**: `projects-column-prototype.jsx`
> **Goal**: Replace chronological timeline with role-grouped columns that communicate "here are the kinds of work I do"

---

## Problem

The current `/projects` page uses a vertical timeline (`ProjectTimeline.tsx`) that reads as a resume. Projects are listed chronologically with expand/collapse, a continuous vertical line, and date headers. This layout:

1. Communicates "history" rather than "range of capabilities"
2. Makes it hard to see that Travis works across 4 distinct roles (Builder, Project Manager, Organizer, Designer)
3. Underuses the section color system: everything renders with a single gold tint
4. Will scale poorly as more projects are added (longer and longer single column)

## Solution

A **column-based portfolio layout** where projects group by role. Each column is a role, each card is a project. The visual language shifts from timeline to capability matrix.

---

## Architecture Decisions

### 1. Server vs Client Component Split

**Decision:** The page (`projects/page.tsx`) remains a **Server Component** for data loading and static rendering. A new **Client Component** (`ProjectColumns.tsx`) handles the interactive column layout with expandable cards.

**Why:** Same pattern as `ProjectTimeline.tsx` today. Server Component loads content via `getCollection()`, shapes the data, passes it as props to a Client Component that manages expand/collapse state.

```
src/app/projects/page.tsx          (Server) → data loading, metadata, page shell
src/components/ProjectColumns.tsx  (Client) → columns, cards, expand/collapse, hover states
```

### 2. Content Schema Extension

The current `projectSchema` in `content.ts` needs one new field:

```typescript
// Current
export const projectSchema = z.object({
  title: z.string(),
  role: z.string(),                    // ← already exists, but freeform
  description: z.string().max(300),
  year: z.coerce.number(),
  date: z.coerce.date(),
  urls: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  order: z.number().default(0),
});

// Addition
  organization: z.string().optional(),   // NEW: org/client name shown in collapsed card
```

**Why `organization` is new:** The spec shows org names (e.g. "Genesee County Land Bank Authority") in collapsed cards. Currently this info is baked into the description. Pulling it out as a discrete field keeps the collapsed view clean and the description for the expanded state.

**Role values stay freeform strings** (not an enum). The column system derives from whatever roles exist in the content. Adding a new role is just adding a new `.md` file with `role: "whatever"`. The color/config map lives in the component, not the schema.

### 3. Role Configuration Map

A static config object maps role slugs to visual properties. Lives in `ProjectColumns.tsx`:

```typescript
interface RoleConfig {
  label: string;
  color: string;      // CSS variable reference
  hex: string;         // for direct use
  rgb: string;         // "r, g, b" for rgba() transparency
  description: string;
}

const ROLE_CONFIG: Record<string, RoleConfig> = {
  builder: {
    label: 'Builder',
    color: 'var(--color-teal)',
    hex: '#2D5F6B',
    rgb: '45, 95, 107',
    description: 'Software, tools, and technical builds',
  },
  'project-manager': {
    label: 'Project Manager',
    color: 'var(--color-terracotta)',
    hex: '#B45A2D',
    rgb: '180, 90, 45',
    description: 'Multi-stakeholder coordination',
  },
  organizer: {
    label: 'Organizer',
    color: 'var(--color-gold)',
    hex: '#C49A4A',
    rgb: '196, 154, 74',
    description: 'Events, conferences, community',
  },
  designer: {
    label: 'Designer',
    color: 'var(--color-success)',
    hex: '#5A7A4A',
    rgb: '90, 122, 74',
    description: 'Visual design, print, branding',
  },
};
```

**Fallback for unknown roles:** If a project has `role: "consultant"` and no config entry exists, use `neutral` styling (`var(--color-ink-secondary)`, rgb `42, 36, 32`). This makes the system extensible without breaking.

### 4. NOT Using RoughBox

**Decision:** Project cards in this layout do NOT use RoughBox.

**Why:** The spec explicitly calls for cards with:
- **No border at rest** (invisible, opacity 0)
- Border **fades in** on hover/expand
- Three distinct tint opacity levels (5.5% / 9% / 10%)

RoughBox always draws a rough.js canvas border and uses a fixed tint class. The three-state interactive tinting here needs dynamic `rgba()` values based on hover/expanded state. Using inline styles (like the prototype) or CSS custom properties is the right approach. RoughBox would fight this at every turn.

The rest of the site keeps RoughBox for its sections. This page intentionally departs from rough borders to let the role-color system speak. The hand-drawn aesthetic still lives in DotGrid, the global paper grain, and the page layout.

### 5. NOT Reusing ProjectTimeline.tsx

**Decision:** `ProjectTimeline.tsx` is not modified or reused. `ProjectColumns.tsx` is a new component.

**Why:** The two layouts have fundamentally different data shapes (flat chronological list vs. role-grouped columns), different interaction models (accordion-like vs. multi-expand), and different visual systems (timeline line + dots vs. column thread lines + role tints). Trying to adapt the timeline component would create a Frankenstein. Clean break.

`ProjectTimeline.tsx` stays in the codebase: it's still used conceptually as the "old" version and could potentially be used for an "all projects chronological" view later.

### 6. Expand/Collapse Animation Strategy

**Decision:** Use `max-height` + `opacity` transition (matching the prototype), not layout animation libraries.

```css
max-height: 0;        → max-height: 300px;
opacity: 0;           → opacity: 1;
overflow: hidden;
transition: max-height 0.3s ease, opacity 0.25s ease;
```

**Why:** This is a lightweight pattern that avoids JS animation libraries. The prototype already demonstrates it works well. The `300px` max-height is generous enough for any card's expanded content. No need for `framer-motion` or `react-spring` for this.

**Trade-off acknowledged:** `max-height` transitions can feel slightly non-linear when the actual content height is much less than the max. Acceptable for this use case. If it feels off, we can switch to measuring actual height with a ref, but start simple.

---

## Component Design

### ProjectColumns.tsx (Client Component)

```
'use client'

Props:
  projects: ProjectColumnEntry[]  — shaped by the Server Component

Internal state:
  expandedIds: Set<string>  — which project cards are expanded

Structure:
  <div>
    {/* Role filter pills */}
    <div className="flex flex-wrap gap-2.5 mb-9">
      {columnOrder.map(roleKey => <RolePill />)}
    </div>

    {/* Column grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
      {columnOrder.map(roleKey => <RoleColumn />)}
    </div>

    {/* Footer count */}
    <div className="mt-14 pt-5 border-t border-border-light">
      <span className="font-mono text-[9px] ...">
        N projects across M roles
      </span>
    </div>
  </div>
```

### RoleColumn (internal, not exported)

```
Structure:
  <div>
    {/* Role header: dot + label + description + border-bottom */}
    <div className="mb-5 pb-3.5 border-b border-border-light">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span style={{ w:8, h:8, bg: role.hex }} />     ← colored dot
        <span className="font-mono text-xs ...">BUILDER</span>
      </div>
      <p className="text-xs text-ink-light ml-[18px]">
        Software, tools, and technical builds
      </p>
    </div>

    {/* Thread line + project cards */}
    <div className="relative pl-[18px]">
      {/* Vertical thread line (absolute, gradient fade) */}
      <div style={{
        position: 'absolute', left: 3, top: 0, bottom: 0, width: 1,
        background: `linear-gradient(to bottom, rgba(${rgb}, 0.25), rgba(${rgb}, 0.05))`
      }} />

      <div className="flex flex-col gap-3">
        {sorted.map(project => (
          <div className="relative">
            {/* Small dot on thread line */}
            <div style={{
              position: 'absolute', left: -18, top: 22,
              w:5, h:5, borderRadius: '50%',
              bg: role.hex, opacity: 0.4
            }} />
            <ProjectCard project={project} roleConfig={role} />
          </div>
        ))}
      </div>

      {/* Column project count */}
      <div className="mt-4 font-mono text-[10px] ...">
        N projects
      </div>
    </div>
  </div>
```

### ProjectCard (internal, not exported)

The card manages its own hover state and receives `expanded`/`onToggle` from parent.

Three visual states via inline styles:

| State | bg opacity | border opacity | shadow opacity |
|-------|-----------|---------------|----------------|
| Rest | 0.055 | 0 | 0.02 |
| Hover | 0.09 | 0.25 | 0.05 |
| Expanded | 0.1 | 0.35 | 0.08 |

```
Collapsed view:
  Date (font-mono, 10px, uppercase, ink-light)
  Title (font-title, 18px, 600 weight)
  Organization (font-body, 13px, ink-light)
  Chevron (right-aligned, rotates 180° when expanded)

Expanded view (below dashed divider):
  Description (font-body, 14.5px, ink-secondary)
  Tags (font-mono, 9px, uppercase pills, role-tinted)
  Links (font-body, 13px, role-colored, arrow icon)
```

### RolePill (internal, not exported)

```
<div className="flex items-center gap-2 py-1.5 px-3.5 border border-border rounded-full"
     style={{ background: `rgba(${rgb}, 0.06)` }}>
  <span style={{ w:6, h:6, bg: role.hex, borderRadius: '50%' }} />
  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-secondary">
    {role.label}
  </span>
  <span className="font-mono text-[9px] text-ink-light">
    {count}
  </span>
</div>
```

---

## Data Flow

```
src/content/projects/*.md
       │
       ▼
getCollection<Project>('projects')    ← Server Component (page.tsx)
       │
       ├── filter: !draft
       ├── shape: pick title, role, date, description, organization, urls, tags
       │
       ▼
<ProjectColumns projects={shaped} />  ← Client Component
       │
       ├── group by role (normalize to lowercase slug)
       ├── sort columns: role with most recent project first
       ├── sort within columns: newest first
       │
       ▼
     Render
```

### Interface Passed to Client

```typescript
interface ProjectColumnEntry {
  slug: string;
  title: string;
  role: string;           // lowercase slug: "builder", "project-manager", etc.
  date: string;           // ISO string (serializable)
  organization?: string;
  description: string;
  urls: { label: string; url: string }[];
  tags: string[];
}
```

**Why ISO string, not Date:** The project data crosses the Server/Client boundary as props. `Date` objects don't serialize in React Server Components. Convert to ISO string in page.tsx, parse in the client component for sorting.

---

## Content Changes

### New Markdown Files

Three new project entries need to be created:

**`src/content/projects/annual-review-2024.md`**
```yaml
---
title: "2024 Annual Review"
role: "Builder"
description: "Designed the Land Bank's 2024 annual review publication, covering the year's demolition, renovation, and community development outcomes."
year: 2024
date: 2024-12-15
organization: "Genesee County Land Bank Authority"
urls:
  - label: "View Publication"
    url: "#"
tags: ["design", "print", "publication"]
featured: false
draft: false
order: 0
---
```

**`src/content/projects/malb-conference.md`**
```yaml
---
title: "MALB Conference"
role: "Organizer"
description: "Organized and coordinated the Michigan Association of Land Banks conference, bringing together land bank professionals from across the state."
year: 2025
date: 2025-03-15
organization: "Michigan Association of Land Banks"
urls: []
tags: ["conference", "community", "planning"]
featured: false
draft: false
order: 0
---
```

**`src/content/projects/gatehouse-branding.md`**
```yaml
---
title: "The Gatehouse Branding"
role: "Designer"
description: "Created the visual identity and branding materials for The Gatehouse project, including signage, print collateral, and digital assets."
year: 2025
date: 2025-06-01
organization: "Community Development"
urls: []
tags: ["branding", "identity"]
featured: false
draft: false
order: 0
---
```

### Existing Files: Add `organization` Field

**`compliance-portal.md`**: Add `organization: "Genesee County Land Bank Authority"`
**`the-gatehouse.md`**: Add `organization: "Community Development"`
**`porchfest.md`**: Add `organization: "Community Event"`

### Existing Files: Update Role Values

The prototype uses lowercase slugged roles (`builder`, `project-manager`, `organizer`, `designer`). Current content uses title case (`Builder`, `Project Manager`, `Organizer`). The component will normalize with `.toLowerCase()` and slugify, but for clarity, update the frontmatter to use consistent slugged values:

- `compliance-portal.md`: `role: "Builder"` (keep, normalize in component)
- `the-gatehouse.md`: `role: "Project Manager"` (keep, normalize in component)
- `porchfest.md`: `role: "Organizer"` (keep, normalize in component)

**Decision:** Normalize in the component rather than changing frontmatter. Users write natural English roles; component slugifies for config lookup.

---

## CSS Changes

### New Utility: `global.css`

No new CSS classes needed. The card three-state tinting uses inline styles (dynamic per role + interaction state). Thread lines are inline styles. This keeps the role-color system self-contained in the component.

### Timeline CSS: Keep or Remove?

**Decision:** Keep `.ptl-*` classes in `global.css` for now. They're only ~90 lines and removing them risks breaking if `ProjectTimeline.tsx` is ever reused. Mark with a comment:

```css
/* ─── Project Timeline (legacy, retained for potential reuse) ─── */
```

### New CSS Variable: `--color-olive` (Designer role)

The Designer role uses `#5A7A4A` (olive/forest green), which is already `--color-success` in the theme. No new variable needed; reference `var(--color-success)`.

---

## Responsive Strategy

| Breakpoint | Columns | Gap | Notes |
|-----------|---------|-----|-------|
| < 768px (mobile) | 1 | 0 (stacked sections) | Role groups stack vertically. Role headers become prominent section dividers. |
| 768px to 1024px (tablet) | 2 | 24px | Third+ columns wrap to next row |
| > 1024px (desktop) | 3 | 32px | Natural column heights (no masonry) |

**Tailwind classes:**
```
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8
```

**Mobile thread line:** On mobile, the thread line and dots still render (they're small and add visual continuity within each stacked section). The padding-left of 18px is fine on mobile.

**Column order on mobile:** Same as desktop (most-recent-role first). This means if Builder has the newest project, it's the first section on mobile. Natural and correct.

---

## Implementation Plan

### Batch 1: Schema + Content (no visual change)

1. Add `organization` field to `projectSchema` in `content.ts`
2. Add `organization` to existing `.md` files
3. Create 3 new `.md` files (annual-review-2024, malb-conference, gatehouse-branding)
4. Verify: `npm run build` passes, no schema errors

### Batch 2: ProjectColumns Component

5. Create `src/components/ProjectColumns.tsx` (Client Component)
   - ROLE_CONFIG map
   - RolePill sub-component
   - RoleColumn sub-component (thread line, dots, header)
   - ProjectCard sub-component (three-state tinting, expand/collapse)
   - Column ordering logic (most-recent-role first)
6. Verify: Component renders in isolation (import in a test page)

### Batch 3: Page Integration

7. Update `src/app/projects/page.tsx`:
   - Replace `ProjectTimeline` import with `ProjectColumns`
   - Shape data: map projects to `ProjectColumnEntry[]` with ISO date strings
   - Keep SectionLabel, page header, metadata
8. Verify: `npm run dev`, navigate to `/projects`, visual check

### Batch 4: Polish + Responsive

9. Test responsive breakpoints (mobile, tablet, desktop)
10. Test expand/collapse for all cards
11. Test with 1, 2, 3, 4+ columns
12. Add ScrollReveal to columns (stagger: column index * 100ms)
13. Verify: `npm run build` passes

### Batch 5: Homepage Projects Section Update

14. Update the homepage "Projects" section to match the new role-grouped language
    - Currently shows `featured` projects in a flat grid
    - Consider: show 1 project per role (most recent from each) instead of 3 featured
    - Or: keep the current homepage section and just update the "All projects" link
    - **Recommendation:** Defer this to a separate task. The homepage section works fine as-is. The `/projects` page is the focus.

---

## What This Design Does NOT Include

- **Interactive filter pills**: Pills are display-only. Making them clickable filters is a future enhancement.
- **RoughBox on cards**: Intentional departure. Cards use role-tinted CSS surfaces instead.
- **Dark mode**: Color system uses rgba() which will need dark mode variants later. Not in scope.
- **Project detail pages** (`/projects/[slug]`): No individual project pages yet. Cards expand in-place.
- **Homepage changes**: The homepage projects section is untouched. Separate task.
- **Removing ProjectTimeline.tsx**: Kept in codebase. Could be useful for a "timeline view" toggle later.

---

## Acceptance Criteria

- [ ] `/projects` renders a multi-column grid grouped by role
- [ ] Columns ordered by most-recent-project-first
- [ ] Cards show collapsed state: date, title, organization, chevron
- [ ] Cards expand to show description, tags, links with dashed divider
- [ ] Multiple cards can be expanded simultaneously
- [ ] Three visual states (rest/hover/expanded) with role-colored tinting
- [ ] Thread line runs through each column with small dots per card
- [ ] Role filter pills display above columns (non-interactive)
- [ ] Responsive: 3 cols (desktop) / 2 cols (tablet) / 1 col (mobile)
- [ ] All 6 projects render across 4 role columns
- [ ] `npm run build` passes (no type errors, no schema validation failures)
- [ ] No dashes in any strings (brand rule)
- [ ] Tags use role-tinted styling
- [ ] Links use role-colored text
- [ ] Footer shows "N projects across M roles"
