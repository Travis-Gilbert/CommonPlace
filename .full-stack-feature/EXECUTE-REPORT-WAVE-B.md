# Execute Report: Wave B (partial) — B1 gallery + B2 validate

**Date:** 2026-08-07  
**Scope:** ARD command gallery substrate wire + program pre-run validate (D24)  
**Status:** B1 + B2 complete; B3–B5 deferred

## Subagent note

[Wire commands gallery](0ea2612d-cccf-4724-b872-0724138ace59) and [Program validate UX](bb204ecb-800d-47c7-9192-f5191eceaba5) hit API usage limits (terra-medium). Parent finished the work.

## What shipped

### Theorem (`rustyred-thg-mcp`)

- `programmable_graph` actions `gallery` and `gallery_fork`
- Gallery lists via `list_gallery` + empty `CommandRegistry` (templates still surface)
- Fork matches template by `name` or `content_id()` (not a nonexistent `id` field)

### CommonPlace console

- `programClient`: `validateProgramDefinition`, `fetchCommandGallery`, `forkGalleryTemplate`, named `LocalDevCommandGallery` stand-in
- `CommandsGalleryView`: loads substrate gallery; forks via `gallery_fork` (not `program.fork`)
- `RunRail` + `ProgramView`: Validate button, summary, refused `nodeIds`

## Validation

| Check | Result |
|---|---|
| `cargo check -p rustyred-thg-mcp` | pass (warnings only) |
| `vitest run src/views/program/programClient.gallery.test.ts` | 3 pass |
| Browser smoke `/commands`, `/program` Validate | not run |

## Deferrals

- B3 Goal Stack, B4 fingerprint, B5 sweep/ghosts
- Live harness gallery may still fall through to LocalDevCommandGallery when empty/unreachable
- Spec-review held until end of ARD execute
