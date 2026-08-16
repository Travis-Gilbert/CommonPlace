# v-d7m — verify text-model migration (verify)

- kind: verify
- controller: agent
- gist: Runs the declared proof commands for d7m and gates: fixture suite green on lapce-xi-rope, encoding tests green, affinity decision recorded with fixture evidence.

## Proof commands

- `cargo +1.96.1 test -p rustyred-thg-text-model` with `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` (run in `Theorem/rustyredcore_THG`).
- Inspect diff: Operation algebra removed where covered; UTF-16 methods retained as LSP utilities; encoding module present with tests.

## Gate

PASS only when: tests green (fixture suite + encoding), affinity paragraph recorded, no scope violations (only text-model crate touched).

## Gate record (2026-08-10) — PASSED

Verify head re-ran the proof command in `Theorem/rustyredcore_THG`: `cargo +1.96.1 test -p rustyred-thg-text-model -j 4` → **16 passed; 0 failed** (fixture suite + 5 encoding tests). Diff inspected: Operation algebra deleted, ropey removed, revision discipline + grouped undo retained, UTF-16 helpers as LSP utilities, `encoding.rs` new, Cargo.lock 32-line change only. Scope check: only `crates/rustyred-thg-text-model/**` touched. Affinity paragraph present in d7m. GATE: PASS.
