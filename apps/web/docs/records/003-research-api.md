# 003: Research API

## Summary

Django project (`research_api/`) for research source tracking, backlink computation, Webmention protocol, and a read-only public API. Sibling service to `publishing_api/`.

## Domain

Tracks sources (books, articles, papers, videos, podcasts, datasets, documents, reports, maps, archives, interviews, websites) linked to published essays and field notes. Generates automatic backlinks between content sharing sources. Tracks research threads showing how investigations develop over time. Receives inbound mentions via W3C Webmention protocol. Maintains an audit trail of all publish operations.

## Architecture

### Apps

| App | Purpose |
|-----|---------|
| `core` | Custom User, TimeStampedModel abstract base |
| `research` | Source, SourceLink, ResearchThread, ThreadEntry |
| `mentions` | Webmention model + webhook receiver |
| `api` | DRF read-only viewsets + computed backlinks endpoint |
| `publisher` | PublishLog model, GitHub API client, JSON serializers, publish orchestrator |

### Data Model

**Source**: title, slug, creator, source_type (13 types: book, article, paper, video, podcast, dataset, document, report, map, archive, interview, website, other), url, publication, date_published, date_encountered, private_annotation (server-only), public_annotation, key_findings (JSONField list), tags (JSONField list), public (boolean, db_index), location_name, latitude (DecimalField 9,6), longitude (DecimalField 9,6). Custom `SourceManager.public()` filters to `public=True`.

**SourceLink**: Links a Source to a content piece (essay or field_note) by content_type + content_slug. Includes content_title (denormalized), role (primary/background/inspiration/data/counterargument/methodology/reference), key_quote, date_linked, notes. Unique constraint on (source, content_type, content_slug).

**ResearchThread**: title, slug, description, status (active/paused/completed/abandoned), started_date, completed_date, resulting_essay_slug, tags (JSONField), public (boolean, db_index). Custom `ResearchThreadManager` with `.public()` and `.active()`.

**ThreadEntry**: thread (FK CASCADE), entry_type (source/note/milestone/connection/question), date, order, source (FK SET_NULL, nullable), field_note_slug, title, description. Ordered by (order, -date).

**Webmention**: source_url, target_url, author metadata, content, mention_type (like/reply/repost/mention/bookmark), verified flag, moderation status (pending/approved/rejected/spam). Unique constraint on (source_url, target_url).

**PublishLog**: data_type (sources/links/threads/mentions/full), record_count, commit_sha, commit_url, success (boolean, db_index), error_message. Read-only in admin. Created automatically by the publish orchestrator after each commit.

### Backlink Engine

Backlinks are **computed, not stored**. Two functions in `apps/research/services.py`:

1. `get_backlinks(content_type, content_slug)`: Finds content sharing sources with a specific piece.
2. `get_all_backlinks()`: Builds the full bidirectional graph for static publishing.

The computation joins SourceLinks via shared source_id. Cheap at single-user scale (tens to hundreds of sources).

Source model also has a `sibling_sources` property that finds other sources sharing the same content via dynamic OR queries across SourceLinks.

### Publishing

`apps/publisher/publish.py` orchestrates:
1. Gathers public sources, links, threads, and backlinks via `.public()` managers
2. Serializes to camelCase JSON (matching Next.js Zod conventions)
3. Commits atomically via Git Trees API to `src/data/research/` in the Next.js repo
4. Creates a `PublishLog` record (success or failure) as an audit trail

Four output files: `sources.json`, `links.json`, `threads.json`, `backlinks.json`.

Management command: `python3 manage.py publish_research` (with `--dry-run` flag).

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/sources/` | GET | Public sources (filterable by type, tag). Lookup by slug. |
| `/api/v1/links/` | GET | Source links (filterable by content_type, content_slug) |
| `/api/v1/threads/` | GET | Public research threads with nested entries. Lookup by slug. |
| `/api/v1/mentions/` | GET | Approved webmentions (filterable by target URL) |
| `/api/v1/backlinks/` | GET | Computed backlinks for a content piece |
| `/webhooks/webmention/` | POST | W3C Webmention receiver (csrf_exempt) |
| `/health/` | GET | Health check (tests DB connectivity) |
| `/admin/` | GET | Django admin (authoring interface) |

### Key Decisions

- **Admin as authoring UI**: No custom editor like publishing_api's Studio. Django admin with rich fieldsets and inlines is sufficient for structured data entry.
- **Backlinks as computed data**: No Backlink model to sync. Derived from SourceLink joins.
- **Webmention verification is synchronous**: At this scale, no task queue needed.
- **DRF read-only**: AllowAny permissions, GET/HEAD/OPTIONS only. No public writes.
- **`private_annotation` excluded from all serializers**: Server-only field never exposed through API or published JSON.
- **`public` boolean with custom managers**: Two-layer access control. Admin sees everything; API and publisher filter to public-only.
- **SourceLink replaces ContentReference**: Clearer name for the join table. Content types narrowed to essay/field_note (removed project).
- **PublishLog in publisher app**: Semantically belongs with the publish orchestrator, not the research models.
- **ThreadEntry.source is FK SET_NULL**: Preserves thread history if a source is deleted.

## Deployment

Same Railway pattern as publishing_api: nixpacks builder, PostgreSQL, gunicorn. Environment variables: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `WEBMENTION_TARGET_DOMAIN`.

## Status

Models redesigned and validated. Django check passes (0 issues). Migrations created and applied (SQLite). All URL patterns resolve. Not yet deployed to Railway.
