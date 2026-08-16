# v-token-kernel — verify token kernel + theme file (verify)

- kind: verify
- controller: agent
- gist: Runs the declared proof commands for token-kernel and gates: kernel check green, theme crate check green, generated Lapce theme file valid.

## Proof commands

- `cargo +1.96.1 check` for `theorem-style` kernel + theme binding (CARGO_TARGET_DIR override).
- Validate the generated Lapce theme file: parses against the fork's theme TOML schema (compare with an existing theme in `Theorem/apps/theorem-ide/lapce/themes/`).
- Inspect evidence `Theorem/docs/plans/intellij-absorption/TOKEN-KERNEL.md`: token provenance recorded, no raw values outside token layer, no margin constructor on block-level surfaces.

## Gate

PASS only when: checks green, theme file valid, evidence complete, no scope violations (rustyredcore_THG and fork source untouched).

## Gate record (2026-08-10) — PASSED

Verify head inspected: `theorem-style` workspace checks green (0 warnings, subagent-run), theme file `theorem-int-ui.toml` present in fork themes/ with schema MATCH (165 keys / 4 tables vs stock defaults — subagent-verified via `--stock-theme` mode). Evidence `TOKEN-KERNEL.md` complete (provenance incl. expUI_dark.theme.json SHA 1a82cda, kernel API, remains). Scope: no rustyredcore_THG or fork-source changes (only new files under apps/theorem-style/ + fork themes/). GATE: PASS. Note: kernel/binding unit tests exist but were not run (cargo check only by mandate) — remains for a later wave.
