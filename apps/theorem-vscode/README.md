# Theorem for the VS Code family

The pack from SPEC-COMMONPLACE-VSCODE-SURFACE-1.0. Everything here runs in stock
VS Code, code-server, and Cursor; the fork in `packaging/commonplace-studio` is
packaging, not a place capabilities live.

| Deliverable | Module |
| --- | --- |
| V1 substrate client | `src/substrate/client.ts` |
| V2 intelligence providers | `src/intelligence/surface.ts` |
| V3 timeline and local history | `src/timeline/history.ts` |
| V4 search over the spine, gated | `src/search/spine.ts` |
| V5 `theorem://` documents | `src/fs/theorem-fs.ts` |
| V6 agent presence | `src/agent/presence.ts`, `src/agent/session-opener.ts` |

## The two things most likely to bite

**Offsets cross an encoding boundary.** The surface measures every span as a
UTF-8 byte offset into the bytes it indexed; VS Code positions are UTF-16 code
units. The conversion lives in
`@commonplace/block-view-contracts/editor-offsets` and is shared with the console
front, so there is one implementation to keep correct. It converts only against
text whose identity is confirmed: a payload carries `content`, and when that does
not equal the buffer the findings are dropped and the drift is named. Drawing
them anyway is the silent failure the whole path exists to prevent.

**Reduced is not an alarm.** `degraded: true` with `missingIndexes:
["compute_code"]` is the steady state for a freshly mounted project, and the
surface still answers. It renders as an Information status with a spinner. Only
an unreachable surface is loud. See `src/degradation.ts`.

## Two gated capabilities

Both are proposed API at microsoft/vscode main, checked 2026-08-02, and both
feature-detect at activation rather than reading a build flag, so one VSIX
behaves correctly everywhere:

- **Search** (`fileSearchProvider2`, `textSearchProvider2`). Not granted means the
  pack registers nothing and VS Code's ripgrep search stands, untouched.
- **Timeline** (`timeline`). Not granted means no Timeline view entries; the same
  revisions are reachable through `Theorem: Show History`.

## Develop

```bash
pnpm --filter theorem-vscode run check          # typecheck
pnpm --filter theorem-vscode run test           # unit tests and the V8 parity fixture
pnpm --filter theorem-vscode run gate:no-timers # V1: the pack polls nothing
pnpm --filter theorem-vscode run build          # dist/extension.cjs and dist/extension.web.js
```

Tests run headlessly against `test/vscode-stub.ts`, a hand-written stand-in for
the `vscode` namespace. Anything the pack starts calling must be added there; a
stub that silently answers `undefined` would let a provider pass against an API it
never called.

## Configuration

`theorem.graphqlUrl`, `theorem.invalidationsUrl`, `theorem.projectId`,
`theorem.consoleOrigin`, `theorem.agentUrl`, `theorem.token`.

`invalidationsUrl` defaults to `/v1/editor/invalidations` on the GraphQL origin,
since one process serves both. Push is disabled only when neither resolves, and
the client says so through its status callback rather than quietly starting to
poll. `projectId` scopes the stream when the server knows it.
