# d7m — text-model migration onto lapce-xi-rope (work)

- kind: work
- controller: agent
- gist: A shrink, not a rewrite: re-back `rustyred-thg-text-model` on `lapce-xi-rope`. Delete the hand-rolled Operation algebra wherever `RopeDelta` covers it; keep the revision discipline, grouped undo with merge semantics, and the clean-room posture; retain UTF-16 methods as LSP utilities only. Fixture suite ports first and is the gate. Open behavioral question resolved by fixtures, not opinion: greedy boundary affinity vs `Spans` transform bias; if `Spans` cannot express the affinity, the interval tree stays ours and transforms through `Transformer`. Substrate durable delta encoding stays ours (byte-offset runs, base length, rev), converted at the store boundary.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 3. Depends on `d7` decision.

## Blueprint

Target: `Theorem/rustyredcore_THG/crates/rustyred-thg-text-model/` (single 664-line `src/lib.rs`, fixtures inline — "observable fixtures are derived from the operation, intervals, and undo").

Sequence:
1. Port the existing fixture suite first (it is the acceptance gate; nothing else counts).
2. Add `lapce-xi-rope` dependency (registry crate; the fork pins the same crate family).
3. Replace hand-rolled Operation algebra with `RopeDelta` where it covers the semantics. Keep: revision discipline, grouped undo with merge semantics, clean-room posture. Retain UTF-16 methods as LSP utilities only.
4. Open question (fixtures decide, not opinion): greedy boundary affinity vs `Spans` transform bias. If `Spans` cannot express the affinity, the interval tree stays ours and transforms through `Transformer`.
5. Durable delta encoding module: byte-offset insert/delete runs, base length, rev — conversion at the store boundary so history never couples to a dependency's serde stability.

## Obligations

- O-d7m.1: `lapce-xi-rope` added; Operation algebra replaced by `RopeDelta` where covered; revision discipline + grouped undo with merge semantics retained; UTF-16 methods retained as LSP utilities only. Proof: `cargo +1.96.1 test -p rustyred-thg-text-model` (fixture suite green) with CARGO_TARGET_DIR override.
- O-d7m.2: Affinity question resolved by fixture outcome, decision recorded in node (greedy affinity vs Spans; interval tree retained or removed with reason). Proof: fixture test exercising boundary affinity + recorded paragraph.
- O-d7m.3: Durable delta encoding module exists (byte-offset runs, base length, rev) with store-boundary conversion, unit-tested. Proof: `cargo test` includes the encoding tests.

## Scope

Writes: `Theorem/rustyredcore_THG/crates/rustyred-thg-text-model/**`. No other crates. No changes to the fork.

## Environment (mandatory)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-ide/.target` — the SSD cargo target (global `~/.cargo/config.toml`) is 100% FULL; never let a build land there. System disk has ~31Gi free; use `cargo check`/`cargo test` with `-j 4` max.
- Toolchain: `cargo +1.96.1` (project toolchain).
- Never `git add -A` in the Theorem repo (shared dirty tree). Commit only this crate's paths if committing.

## Acceptance

Fixture suite green on xi-rope; encoding module tested; decision paragraph recorded.

## Discharge (2026-08-10)

- O-d7m.1 DISCHARGED: `lapce-xi-rope 0.3.2` added; hand-rolled `Operation` algebra deleted (664 → 767 lines); `ropey` removed; revision discipline kept (model gained `rev: u64` stamped on ChangeReceipt + durable encodings); grouped undo with merge semantics kept; UTF-16 methods retained as byte↔utf16 LSP-facing utilities only. Proof: `cargo +1.96.1 test -p rustyred-thg-text-model -j 4` → 16/16 pass (re-run by verify head 2026-08-10).
- O-d7m.2 DISCHARGED: affinity resolved by fixtures, not opinion — `Spans::transform` hard-codes start→after=false/end→after=true, so greedy boundary affinity cannot be expressed by Spans; interval tree stays ours (`BTreeMap<IntervalId, TrackedInterval>`), each boundary transforms through xi-rope `Transformer` with `after = !greedy_left`/`greedy_right`. Fixture evidence: `intervals_preserve_greedy_boundary_behavior` + new `boundary_affinity_is_per_boundary_and_independent`.
- O-d7m.3 DISCHARGED: `src/encoding.rs` (353 lines) — `DurableDelta { base_len, rev, inserts, deletes }`, serde-owned, independent of xi-rope serde; `from_delta`/`to_delta` inverse up to delta equivalence, round-trip + serde-stability tests (5 encoding tests green).
- Note for consumers: `len_chars` → `len_bytes` (byte-based core); UTF-16 helpers renamed byte↔utf16 (same fixture values).

STATE: done. Verify sibling: v-d7m (gate PASSED 2026-08-10).
