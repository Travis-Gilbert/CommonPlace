# Django Studio Redesign: Full Site Control Panel

## Context

Django Studio currently edits 5 of 6 content types and publishes `.md` files via GitHub API. It cannot edit site configuration, design tokens, navigation, page layout, or component settings. The Toolkit content type has no model. There is no delete flow, no working autosave, and the status workflow (dropdown + checkbox) is disconnected and unclear.

This redesign transforms Studio from a content editor into a comprehensive site management tool. Every visual and structural aspect of travisgilbert.com becomes editable from the backend, delivered through the existing GitHub commit pipeline.

## Design Summary

### Two-Category Data Architecture

| Category | Format | Destination | Examples |
|----------|--------|-------------|----------|
| Content | Individual `.md` files | `src/content/{type}/{slug}.md` | Essays, field notes, shelf, projects, toolkit, now |
| Site Config | Single JSON file | `src/config/site.json` | Design tokens, nav, footer, SEO, page compositions |

Both categories flow through the same pipeline: Django serializes -> GitHub Contents API commit -> Vercel auto-deploys.

### New Django Models

**`DesignTokenSet`** (singleton)
- `colors`: JSONField (brand colors: terracotta, teal, gold, green; surface colors: parchment, dark ground, cream)
- `fonts`: JSONField (title, body, mono, annotation, tagline mappings)
- `spacing`: JSONField (content max-width, margin sizes)
- `section_colors`: JSONField (which brand color maps to which section)

**`NavItem`** (ordered list)
- `label`: CharField
- `path`: CharField
- `icon`: CharField (SketchIcon name)
- `visible`: BooleanField
- `order`: IntegerField

**`PageComposition`** (one row per page key)
- `page_key`: CharField(unique=True) (e.g. "home", "essays", "essay_detail")
- `settings`: JSONField (per-page component configuration)
- Predefined schemas per page_key validated at the form/serializer layer

**`SiteSettings`** (singleton)
- `footer_tagline`: CharField
- `footer_links`: JSONField
- `seo_title_template`: CharField
- `seo_description`: TextField
- `seo_og_image_fallback`: CharField
- `global_toggles`: JSONField (dotgrid_enabled, paper_grain_enabled, console_easter_egg)

**`ToolkitEntry`** (new content model)
- `title`, `slug`, `category`, `order`, `body`, `draft`
- Two-stage pipeline: Draft -> Published

**Composition JSONField** added to all content models (Essay, FieldNote, ShelfEntry, Project, ToolkitEntry):
- Per-instance visual overrides serialized into frontmatter under a `composition:` key
- Schema varies per type (essay: heroStyle, overlay, accent; project: tint override, etc.)

### Visual Status Pipeline

Replaces the `stage`/`status` dropdown + `draft` checkbox with a clickable horizontal pipeline at the top of each editor.

**Per-type stages (unchanged values, new UI):**
- Essay: Research -> Drafting -> Production -> Published
- Field Note: Observation -> Developing -> Connected
- Shelf/Project/Toolkit: Draft -> Published (minimal two-stage)

**Key behavior:**
- `draft` boolean is removed from all models; derived as `@property` from stage position
- Clicking a stage advances/rolls back via HTMX POST to `/<type>/<slug>/set-stage/`
- Final stage click triggers publish confirmation (same HTMX flow)
- Reusable template include: `_status_pipeline.html` takes stage list + current value

### Page Composition Settings

**Template pages** (one composition row each):

| Page Key | Configurable Settings |
|----------|----------------------|
| `home` | Hero fragments (position, rotation, opacity, hideOnMobile), featured content slots (essay, field note, projects), NowPreview (show/hide), DotGrid (friction, dot size, hero zone color), CyclingTagline (phrases, speed) |
| `essays` | Featured essay override, cards per page, layout density |
| `field_notes` | Featured note override, layout variant |
| `projects` | Role order, column divider opacity, role color overrides |
| `shelf` | Default filter, visible type filters |
| `toolkit` | Category ordering, section collapse defaults |
| `connect` | Content blocks, links |
| `colophon` | Bill of Materials entries, visibility toggles |
| `now` | Card layout variant, visible fields |

**Detail page templates** (global defaults for all instances of a type):

| Page Key | Settings |
|----------|----------|
| `essay_detail` | ReadingProgress (show/hide, color), comments (enabled/disabled), margin annotation default side, hero overlay opacity |
| `field_note_detail` | Related notes (show/hide), connected essay link style |

### Configuration Cascade

```
global.css hardcoded defaults
  -> overridden by site.json design tokens
    -> overridden by page composition (template-level)
      -> overridden by content instance composition (per-item)
```

Each layer is optional. The site works with zero config (current state is the fallback).

### Studio UI Structure

Three-zone sidebar navigation:

**CONTENT** (existing, expanded):
- Essays, Field Notes, Shelf, Projects, Toolkit (new), Now
- Each shows draft badge count
- Editors gain: status pipeline at top, composition panel in sidebar

**COMPOSE** (new):
- Homepage (dedicated composer)
- Pages (sub-list of other page templates)

**SETTINGS** (new):
- Design Tokens (color pickers, font selectors, spacing inputs)
- Navigation (drag-to-reorder nav items)
- SEO (title template, description, OG defaults)
- Publish Log (moved from dashboard)

Dashboard becomes a landing page: draft counts, recent publishes, quick-create, site health checks.

### Structured JSON Field Inputs

Currently, `JsonObjectListWidget` renders a raw `<textarea class="field-json">` showing pretty-printed JSON. Users must hand-edit JSON to add sources, annotations, URLs, or callouts. The hint says "JSON array of {title, url} objects" which is technically accurate but unfriendly.

**Replacement: `StructuredListWidget`** renders a dynamic row-based UI. Each row shows labeled inputs for the object's fields, with + Add and x Remove buttons. HTMX handles add/remove without full page reloads.

**Per-field type configurations:**

| Field | Object Shape | Row UI |
|-------|-------------|--------|
| `sources` | `{title, url}` | Two text inputs per row: "Title" + "URL" |
| `annotations` | `{paragraph, text}` | Number input "Paragraph #" + textarea "Note" |
| `urls` | `{label, url}` | Two text inputs: "Label" + "URL" |
| `callouts` | `{text, side}` | Text input "Text" + select dropdown "Side" (left/right) |

**Widget architecture:**
- `StructuredListWidget` replaces `JsonObjectListWidget` in `widgets.py`
- Takes a `fields_schema` parameter defining each sub-field's name, type, label, and placeholder
- `format_value()`: parses JSON array, renders one `<div class="structured-row">` per item with appropriate inputs
- `value_from_datadict()`: collects form arrays (`name__0__title`, `name__0__url`, `name__1__title`, etc.) and assembles back to JSON
- Template: `_structured_list_field.html` include, with HTMX `hx-post` on + Add to append a new empty row

**For `related` (SlugListWidget):** Replace the comma-separated text input with a **searchable dropdown** that queries published essay slugs. HTMX autocomplete on the input that searches `/api/content-slugs/?type=essay&q=...` endpoint. Still stores as JSON array of slugs. Similarly, `connected_to` and `connected_essay` fields become slug dropdowns instead of free text.

**For `tags` (TagsWidget):** Keep the comma-separated input but add a **tag suggestion dropdown** showing existing tags from the DB. New HTMX endpoint: `/api/tags/?q=...` returns tags matching the query.

### Markdown Editor Toolbar

The body textarea (`<textarea class="field-body">`) is currently bare: no toolbar, no formatting hints, no preview. The only enhancement is Tab-indent (4 spaces) and Cmd+S save in `studio.js`.

**Addition: a minimal markdown toolbar** above the textarea with commonly used formatting buttons:

```
B  I  H1  H2  H3  ---  *  1.  ""  <>  link  preview
```

**Buttons and their actions (all insert markdown syntax at cursor):**
- **B** (bold): wraps selection in `**...**`
- **I** (italic): wraps selection in `*...*`
- **H1/H2/H3**: inserts `## ` / `### ` / `#### ` at line start (H1 reserved for title)
- **---** (rule): inserts `---\n`
- **\*** (unordered list): inserts `- ` at line start
- **1.** (ordered list): inserts `1. ` at line start
- **""** (blockquote): inserts `> ` at line start
- **<>** (code): wraps selection in backticks (single for inline, triple for block if multiline)
- **link**: inserts `[text](url)` template
- **preview**: toggles a side-by-side rendered preview panel

**Implementation:**
- Pure JavaScript in `studio.js` (no external dependency)
- Toolbar is a `<div class="editor-toolbar">` rendered by the template, not the widget (keeps widget simple)
- Each button calls a `insertMarkdown(type)` function that manipulates the textarea's `selectionStart`/`selectionEnd`
- Preview toggle: fetches rendered HTML from a new `/api/preview-markdown/` endpoint (POST body markdown, returns HTML) via HTMX, or renders client-side with a lightweight library (e.g., `marked` via CDN)
- Keyboard shortcuts: Cmd+B for bold, Cmd+I for italic, Cmd+K for link (standard editor bindings)

**CSS additions to `studio.css`:**
- `.editor-toolbar`: flex row of small icon buttons above the textarea, border-bottom matches sidebar border
- `.toolbar-btn`: 28px square, monospace font, subtle hover, no border by default
- `.toolbar-btn.active`: for toggleable buttons like preview
- `.editor-preview`: side-by-side pane when preview is active, renders HTML with prose-like styles matching the main site

### Content Gaps Fixed

1. **Toolkit model**: Full CRUD + publish, two-stage pipeline
2. **Delete flow**: Confirmation modal (type slug to confirm), DB delete + GitHub file deletion via Contents API DELETE, PublishLog records deletion
3. **Autosave**: Debounced 3s in studio.js, PATCH to `/auto-save/`, field-level (only changed fields), quiet "Saved" indicator
4. **Callouts schema fix**: Align Zod `callouts` to `{text, side}[]` (Django is correct, Zod needs update)

### Next.js Integration

**New file: `src/lib/siteConfig.ts`**
- Reads and validates `src/config/site.json` with Zod
- Exports `getSiteConfig()` and `getPageComposition(pageKey)`
- Falls back to hardcoded defaults when file doesn't exist

**How components consume config:**
- `layout.tsx`: reads tokens, injects as CSS custom properties on `<html>`
- `TopNav.tsx`: reads nav items from config instead of hardcoded array
- Page Server Components: call `getPageComposition()` and pass settings as props
- Content components: destructure `composition` from frontmatter alongside existing fields

**Publish flow (updated):**
- Content publish: serialize `.md` + re-serialize `site.json` if compositions reference the content
- Config publish: serialize `site.json` only
- Multi-file atomic commits via Git Trees API when both change

### `site.json` Structure

```json
{
  "tokens": {
    "colors": {
      "terracotta": "#B45A2D",
      "teal": "#2D5F6B",
      "gold": "#C49A4A",
      "green": "#5A7A4A",
      "parchment": "#F5F0E8",
      "darkGround": "#2A2824",
      "cream": "#F0EBE3"
    },
    "fonts": {
      "title": "Vollkorn",
      "body": "Cabin",
      "mono": "Courier Prime",
      "annotation": "Caveat",
      "tagline": "Ysabeau"
    },
    "spacing": {
      "contentMaxWidth": "896px",
      "heroMaxWidth": "1152px"
    }
  },
  "nav": [
    { "label": "Essays on...", "path": "/essays", "icon": "file-text", "visible": true },
    { "label": "Field Notes", "path": "/field-notes", "icon": "note-pencil", "visible": true }
  ],
  "footer": {
    "tagline": "...",
    "links": []
  },
  "seo": {
    "titleTemplate": "%s | travisgilbert.com",
    "description": "..."
  },
  "pages": {
    "home": {
      "hero": { "fragments": [], "gridTemplate": "1fr 118px 1fr" },
      "featured": {
        "essay": "the-parking-lot-problem",
        "fieldNote": "some-note",
        "projects": ["proj-1", "proj-2"]
      },
      "dotgrid": { "friction": 0.97, "heroZoneColor": [240, 235, 228], "crossfadeBand": 50 },
      "nowPreview": { "visible": true, "gridSize": "2x2" },
      "cyclingTagline": { "phrases": ["..."], "speed": 80 }
    },
    "essays": { "featured": null, "cardsPerPage": 12, "density": "normal" },
    "essay_detail": {
      "readingProgress": true,
      "commentsEnabled": true,
      "marginSide": "right",
      "heroOverlay": 0.7
    }
  }
}
```

## Critical Files to Modify

### Django (publishing_api/)

| File | Changes |
|------|---------|
| `apps/content/models.py` | Add ToolkitEntry, DesignTokenSet, NavItem, PageComposition, SiteSettings. Add `composition` JSONField to Essay, FieldNote, ShelfEntry, Project. Remove `draft` BooleanField, add `is_draft` property. |
| `apps/content/admin.py` | Register new models |
| `apps/editor/forms.py` | Add ToolkitEntryForm, DesignTokenSetForm, NavItemFormSet, PageCompositionForm, SiteSettingsForm. Add composition widget to all content forms. |
| `apps/editor/views.py` | Add Toolkit CRUD views, Compose views (page composer), Settings views (tokens, nav, SEO), delete views, set-stage endpoint. Redesign DashboardView. |
| `apps/editor/urls.py` | Add routes for toolkit, compose, settings, delete, set-stage |
| `apps/editor/widgets.py` | Add StructuredListWidget, CompositionWidget (schema-aware JSON editor), ColorPickerWidget, SliderWidget |
| `apps/publisher/serializers.py` | Add `serialize_toolkit()`, `serialize_site_config()`. Update all content serializers to include `composition` key. |
| `apps/publisher/publish.py` | Add `publish_toolkit()`, `publish_site_config()`, `delete_file()`. Update publish flow for multi-file commits. |
| `apps/publisher/github.py` | Add `delete_file()` method, add Git Trees API support for multi-file atomic commits. |
| `templates/editor/base.html` | Redesign to three-zone sidebar navigation |
| `templates/editor/dashboard.html` | Redesign with draft counts, site health, quick-create |
| `templates/editor/edit.html` | Add status pipeline include, composition panel, delete button, markdown toolbar |
| `templates/editor/_status_pipeline.html` | New: reusable pipeline component |
| `templates/editor/compose_page.html` | New: page composer template |
| `templates/editor/tokens.html` | New: design tokens editor |
| `templates/editor/nav_editor.html` | New: drag-to-reorder nav editor |
| `templates/editor/settings.html` | New: SEO and global toggles |
| `static/css/studio.css` | Update for new sidebar layout, pipeline component, composition panel, toolbar, structured list |
| `static/js/studio.js` | Add autosave debounce, pipeline click handlers, drag-reorder, markdown toolbar, structured list JS |
| `apps/content/management/commands/import_content.py` | Add toolkit to TYPE_REGISTRY |

### Next.js (src/)

| File | Changes |
|------|---------|
| `src/config/site.json` | New: committed by Django, read at build time |
| `src/lib/siteConfig.ts` | New: Zod-validated config loader with `getSiteConfig()` and `getPageComposition()` |
| `src/lib/content.ts` | Update Zod schemas: add `composition` to all content schemas, fix `callouts` to `{text, side}[]`, add `toolkitSchema` |
| `src/app/layout.tsx` | Read tokens from siteConfig, inject as CSS custom properties |
| `src/components/TopNav.tsx` | Read nav items from siteConfig instead of hardcoded array |
| `src/app/page.tsx` | Read homepage composition for featured slots, hero config |
| `src/components/CollageHero.tsx` | Accept fragment config as props instead of hardcoded FRAGMENTS |
| `src/components/DotGrid.tsx` | Accept friction/color params from composition |
| `src/components/CyclingTagline.tsx` | Accept phrases/speed from composition |
| `src/styles/global.css` | Token values become fallback defaults (CSS custom property fallback syntax) |

## Verification Plan

1. **Django migrations**: Run `makemigrations` + `migrate`, verify 0 errors
2. **Import command**: Run `import_content` to populate DB including new toolkit entries
3. **Dashboard**: Navigate to `/`, verify three-zone sidebar renders, draft counts show
4. **Content editing**: Create/edit/delete an essay through full lifecycle; verify pipeline advances stages
5. **Autosave**: Type in body field, verify quiet save indicator after 3s pause
6. **Page composer**: Edit homepage composition, publish, verify `site.json` committed to GitHub
7. **Design tokens**: Change terracotta hex, publish, verify `site.json` updated
8. **Nav editor**: Reorder nav items, publish, verify `site.json` nav array order
9. **Next.js build**: Run `npm run build` with `site.json` present, verify pages render with config values
10. **Fallback**: Delete `site.json`, rebuild, verify site renders with hardcoded defaults
11. **Delete flow**: Delete a shelf entry, verify GitHub file deletion and PublishLog entry
12. **Toolkit**: Create, edit, publish a toolkit entry, verify `.md` file appears in repo
