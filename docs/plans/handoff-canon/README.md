# HANDOFF-CANON implementation notes

Canonical handoff: `HANDOFF-CANON.md`. Design reference: `design/path-lens-frontend-ref.png`.

## Shipped in this pass

| Item | Status |
|---|---|
| C1 `packages/canon/canon.json` | Done |
| C2 `apps/web/scripts/scan-canon.mjs` → `canon-scan.json` | Done |
| C3 unused cut (23 packages with zero importers) | Done |
| C3 live migrations (icons, motion, dnd, markdown, charts, blocksuite, pdf, browser-ml, gsap) | Done |
| C4 `lint-canon.mjs` + allowlist + CI + self-test | Done (allowlist emptied after migrations) |
| C5 size-limit surfaces | Done (shared + console ratchet; tighten after further cuts) |
| PL1 `pathTo` + scopes | Done |
| PL2 Path ViewDescriptor + cosmos `setPathChain` | Done |
| PL3 four scope labels | Done |
| PL4 draft/review/apply/rollback | Done (React state review; signal via `proposalSignalIds` + path chain) |

## Gate behavior

- Every `apps/web` runtime dependency must appear in `canon.json`.
- Banned imports fail unless the file is listed in `import-allowlist.json` (C2 grandfather).
- New files importing banned packages fail CI immediately.
- `lint:canon:self-test` plants a sigma import and expects red.

## Commands

```bash
pnpm --filter @commonplace/web run lint:canon
pnpm --filter @commonplace/web run lint:canon:self-test
pnpm --filter @commonplace/web run scan:canon
pnpm --filter @commonplace/web run test
```

## Verify-first open questions (still product calls)

- Does `@cosmos.gl/graph` cover embedding-atlas scatter? Scan leaves `embedding-atlas` undecided.
- Path uses one cosmos canvas + `setPathChain` (no second instance).
- BlockSuite presets cut from FileItemViewer; canvas Items show an honest empty / TipTap redirect.
- `@huggingface/transformers` offline Keep: undecided (FoundationEncoder still imports it).
