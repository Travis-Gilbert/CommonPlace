# Execute Checklist: Wave B — Command graph / execution fabric

**Shape:** checklist  
**Authority:** `.full-stack-feature/00-research-map.md` Wave B; ARD D19–D24, P3  
**Subagents:** gpt-5.6-terra-medium (API limit — parent finished B1/B2)

## Rows

| ID | Task | Status | Evidence | Validation | Notes |
|---|---|---|---|---|---|
| B1 | Commands gallery → substrate gallery/fork (not fixtures / program.fork) | done | MCP `gallery`/`gallery_fork`; `CommandsGalleryView` + `programClient`; LocalDevCommandGallery stand-in | `vitest …programClient.gallery.test.ts` (3 pass); `cargo check -p rustyred-thg-mcp` | terra subagent failed; parent wired |
| B2 | Program canvas pre-run validate (D24) | done | RunRail Validate + `validateProgramDefinition`; node-id highlight on refusal | same gallery test file covers validate parse | terra subagent failed; parent wired |
| B3 | P3 Goal Stack demote/fold | pending | | | defer |
| B4 | Fingerprint inspector (D22) | pending | | | needs substrate fields |
| B5 | Sweep + expansion ghosts (D20–D21) | pending | | | blocked on substrate |

## Explicit non-goals this pass
- Sweep ChainForge stack until Rust primitive exists
- WorkOS / Dagster / Blender (Wave C)
- Second invoke path
- Full ARD spec-review (deferred to end)
