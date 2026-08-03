# EDITOR-DX consumer feedback

Register: wire. Audience: whoever continues the editor surface in `travis-gilbert/theorem`.

Source read: PR #436 `feat/four-spec-open-closure`, files `apps/commonplace-api/schema.graphql`,
`src/editor_intelligence.rs`, `tests/editor_intelligence_acceptance.rs`, `src/editor_mcp.rs`.
Consumer: the VS Code pack in `Travis-Gilbert/CommonPlace` PR #162 (`apps/theorem-vscode`), plus the
console CM6 front (`apps/console/src/views/CodeFileView.tsx`). Both read the same payloads, which is
what SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V8 compares.

Everything below is what a second, independent consumer needed and could not get. Nothing here asks
for a redesign; the shape is right.

## Correct as landed, do not change

- Generation on every payload, and the same generation across `semanticTokens`, `diagnostics`, and
  `intentions` for one file. This is what makes cross-provider consistency checkable.
- `degraded` + `missingIndexes` as values on the payload rather than errors. Answering without
  `compute_code` and saying so is the right behavior.
- Opaque `fixId` handles bound to path, generation, and base hash. A consumer cannot forge or
  replay one, which is correct.
- `applyFix` returning the edits it applied plus `appliedGeneration`. The write is the server's.
- `restoreRevision` producing a new revision rather than rewinding history.
- `inlayHints` returning an empty list with the field description saying the core provider is
  intentionally empty. Documented emptiness is not a gap.

## Blocking gaps

Ordered by what breaks without them.

### G1. Read payloads carry no content identity

`applyFix` returns `baseContentHash`. `semanticTokens`, `diagnostics`, `intentions`, and
`inlayHints` return only `generation`.

Every span on those payloads is a UTF-8 byte offset into the bytes the server indexed. Both
consumers address text differently: VS Code positions are UTF-16 code units, CodeMirror 6 offsets
are UTF-16 code units. Converting a byte offset requires *the exact bytes the server measured*. A
generation counter does not let a client verify it holds those bytes. When the client's buffer and
the server's mount disagree by even one byte, every diagnostic and every token silently lands on the
wrong characters. Silently is the problem: there is no signal to degrade on.

Ask: add `contentHash: String!` to all four payloads, computed the same way as
`ApplyEditorFixGql.baseContentHash`. A client that has the file's bytes can then confirm identity
before rendering, and honestly degrade when it cannot.

Stronger option, if cheap: return the indexed `content: String` on request, so a client with no
filesystem access (the web workbench, `code serve-web`) can convert offsets at all. Today a browser
host has no way to resolve a byte offset it cannot read the bytes for.

### G2. No fix preview

`applyFix(fixId: String!)` mutates. There is no pure call that returns the same edits.

SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V2 requires "an applied fix round-trips preview-equals-applied",
and any editor wants to show a fix before running it. `editor_intelligence.rs` already models a
`PendingEditorFix` with a `preview` field, so the value exists server-side and is not exposed.

Ask: `previewFix(fixId: String!): ApplyEditorFixGql!` as a query, or
`applyFix(fixId: String!, preview: Boolean! = false)`.

Related: define the refusal when `baseContentHash` no longer matches at apply time. A typed refusal
payload beats a generic GraphQL error, because the consumer's correct response is specific — re-read
the file, re-fetch intentions, re-offer the fix.

### G3. No document body write, so graph documents cannot be edited

`editItem(id, title, tags, residency, validFromMs, validToMs)` writes metadata only. `putNote(title,
text)` creates. Nothing writes the body of an existing item.

VSCODE-SURFACE V5 opens specs, records, and plan documents as editable buffers over a `theorem://`
FileSystemProvider and saves through the object seam with receipts. That deliverable has no landing
surface. The pack currently sends `writeObjectDocument`, a mutation that does not exist, and gets an
honest degraded state, which is correct behavior over a missing seam and useless as a product.

Ask: `writeItemBody(id: String!, text: String!, baseContentHash: String!): ItemWriteReceiptGql!`
returning a retrievable receipt id, with the same optimistic-concurrency refusal as G2.

### G4. No file write, so the editor cannot save

`applyFix` writes. `restoreRevision` writes. A person typing in the editor has no way to save.

This blocks the console CM6 front's `save` and `saveAll` (EDITOR-DX 1.1 M1) and any VS Code write
that is not a fix. Both fronts currently write through the local filesystem instead, which means the
VFS journal sees the change only through the watcher, and there is no receipt.

Ask: `writeFile(path: String!, content: String!, baseContentHash: String!): FileWriteReceiptGql!`,
refusing on hash mismatch, and refreshing through the VFS the way `restoreRevision` already does.

### G5. No push door for standing queries

The schema has no `Subscription` type. `/v1/slots/stream` exists on `rustyred-thg-server` for slot
changes.

The Not-LSP architecture is standing queries, and standing queries need an invalidation signal or
they become polling. The VS Code pack holds one SSE connection and re-queries authoritatively on any
event; that works, but the event contract is undocumented, so the client cannot tell which file
changed and re-queries everything.

Ask, in preference order:

1. `Subscription { editorInvalidated(projectId: String!): EditorInvalidationGql! }` carrying `path`
   and `generation`.
2. Or document `/v1/slots/stream`'s event shape and confirm editor mutations emit on it with the
   affected path.

Either one lets a consumer re-query one file instead of all of them.

## Undocumented vocabularies

Each of these is typed `String` on the wire with no published value set. A consumer must either
guess or render raw wire codes to a reader, and the codes leak into UI the moment anyone forgets.

| Field | What is known | Ask |
| --- | --- | --- |
| `EditorDiagnosticGql.severity` | Rust `Severity::to_string()` | GraphQL enum, or the published set |
| `EditorDiagnosticGql.detector` | `text.trailing_whitespace` from the test | Published registry of detector ids |
| `missingIndexes[]` | `compute_code` from the test | Published set, ideally an enum |
| `ReadinessCapabilityGql.state` | unknown | Enum |
| `EditorIntentionGql.kind` | unknown | Enum |
| `InlayHintGql.kind` | unknown | Enum |
| `anchorKind` / `anchorPath` | unknown | Semantics: what `anchorPath`'s integers index, and how a client re-anchors a span after an edit |

`anchorKind`/`anchorPath` matter most. They are on every token and every finding, they clearly exist
to survive edits, and a consumer that does not know how to walk them just ignores them and falls
back to raw byte spans — which is exactly the fragility they were added to fix.

The two block-action ids are already stable and correct: `editor.send_selection_to_composer` and
`editor.save_selection_to_graph`. Publishing them as constants would let consumers stop
string-matching.

## Mount contract

`tests/editor_intelligence_acceptance.rs` calls `createProject`, then `addContentRoot`, then queries
by `path`. Undocumented for a consumer:

- Is `file:` an absolute filesystem path, a project-relative path, or a VFS URI?
- How does a client map an editor workspace folder to a `projectId`?
- Must a file be under a content root before `diagnostics(file:)` answers, and what does the surface
  answer for an unmounted path — a refusal, or `degraded` with an empty list? These are very
  different for a consumer: one is an error to surface, the other is a state to render.
- Editor payloads carry no `projectId`. Two mounted projects with the same relative path are
  indistinguishable in a response.

## Verify: 32-bit `Int` on 64-bit values

`FileRevisionGql.timestampMs: Int!` and `generation: Int!` are GraphQL `Int`, which the spec defines
as signed 32-bit. Epoch milliseconds are ~1.78e12 today, well past 2147483647.

async-graphql maps Rust `i64` onto the `Int` type name, so this may serialize fine server-side while
spec-compliant clients and codegen (graphql-js, Apollo, typed codegen) treat the field as 32-bit and
either truncate or reject. The VS Code pack reads these as plain JSON numbers and is unaffected;
anything generated from the SDL is not.

Ask: confirm against a real client, and if it holds, move `timestampMs` (and any long-lived
`generation`) to a 64-bit-safe scalar. Same question for `validFromMs` / `validToMs` on
`putNote`/`editItem` and `timestampMs` on `judgeAnalogyTransfer`.

## Consumer-side facts worth knowing

Not asks. Things the editor surface's design decided that consumers must now live with, recorded so
the next consumer does not rediscover them.

- **`degraded: true` is the steady state.** The acceptance test asserts `degraded == true` and
  `missingIndexes == ["compute_code"]` for a freshly mounted project, with tokens and fixes still
  answering. A consumer that renders any degradation as an alarm pins a permanent warning to a
  working editor. Reduced-but-answering must read as quiet; only unreachable is loud. The VS Code
  pack was built the wrong way round and is being corrected.
- **Byte offsets cross a UTF-16 boundary at both consumers.** See G1. Any file with non-ASCII text
  is where this shows up first, so both fronts now carry multibyte content in their parity fixture.
- **`applyFix` is the only preview-shaped value with no pure read**, so a consumer that wants to
  show a fix must either mutate or not show it. See G2.

## Minor

- `diagnostics(file:)` takes no range while `semanticTokens` and `inlayHints` do. Whole-file
  diagnostics are usually right; noting the asymmetry in case it was unintentional.
- `readiness` is global, not per project or per file. A per-file `degraded`/`missingIndexes` already
  covers the file case, so this is likely fine, but a consumer showing a workspace-level chip cannot
  scope it.
