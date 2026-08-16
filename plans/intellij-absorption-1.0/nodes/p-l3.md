# p-l3 — K8 probe onto Lapce's editor behavior layer (probe)

- kind: probe
- controller: agent
- gist: K8 retargets onto Lapce's editor behavior layer: inventory what the fork inherits working (keymap, palette on nucleo, explorer, panels, LSP/DAP, settings), map the IdeaVim corpus as the behavior torture suite, and flip K2/K5/K6 into upgrade-decision probes against the inherited implementations.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 board amendment 3 + CLOSURE-MANIFEST K11 tier.

## Blueprint

Read-only probe over the fork (`Theorem/apps/theorem-ide/lapce`). No source changes.

1. Inventory inherited editor behavior surfaces with file refs: keymap system (`lapce-core`/`lapce-app` keymap + commands), palette (nucleo), explorer, panels (terminal gated), LSP/DAP integration (`lapce-proxy` dispatch + `lapce-rpc`), settings system.
2. Map K8 (IdeaVim corpus as editor-behavior torture suite) onto those surfaces: which behaviors are already expressible (keymap entries, commands), which need upgrades.
3. K2/K5/K6 lanes as upgrade-decision probes: for each lane (keymap/command system; ...; read the closure manifest's lane table at `Theorem/docs/CLOSURE-MANIFEST-SKELETON-INTELLIJ-ABSORPTION-1.0.md` for K2/K5/K6 definitions), state the inherited implementation and the probe that would decide upgrade-vs-keep.
4. Record which of g0's five open acceptance items (real-OS IME, GL fallback, one-frame keystroke budget, copy/paste/scroll, a11y decision) are informed by this probe.

## Obligations

- O-P.1: Inherited-behavior inventory with file refs. Proof: evidence file section.
- O-P.2: K8 map (IdeaVim corpus → inherited surfaces, expressible vs upgrade). Proof: evidence file section.
- O-P.3: K2/K5/K6 upgrade-decision probes stated with their deciding evidence. Proof: evidence file section.

## Scope

Reads: the fork + closure manifest + S0 evidence (`Theorem/docs/plans/intellij-absorption/S0-LAPCE-SPIKE.md`). Writes: evidence file `Theorem/docs/plans/intellij-absorption/P-L3-PROBE.md` only.

## Acceptance

Evidence file complete with the three sections; no source changes anywhere.

## Discharge (2026-08-10)

- O-P.1 DISCHARGED: inherited-behavior inventory with file refs — keymap/commands (TOML loader, chords, when-conditions, 142 common entries; one `run_command` entry for 7 command classes + floem-command bridge), palette (nucleo 0.5, off-main-thread filtering, run-id cancellation), explorer/panels/settings (file_explorer/, panel/ 11 kinds, layered config over defaults/settings.toml), LSP/DAP (lapce-rpc proxy.rs full surface + native Dispatcher + wasm stub), editor primitives (xi-rope buffer, EditType-grouped undo, multicaret Selection/Cursor, visual block mode, Register, motion-mode operators). Surprise: the editor model lives in the floem git dep (`floem_editor_core`) — lapce-core is a 13-line re-export.
- O-P.2 DISCHARGED: K8 map — IdeaVim corpus (`~/Tech Dev Local/oracle/ideavim`, 76 test files) in three buckets: already-expressible (h/j/k/l/w/b/e, gg/G, motions, text ops via motion mode, v/V/Ctrl-v, u/Ctrl-r, p/P, %, f/F/;, marks, scroll, Ctrl-w splits, counts — with cited keymap entries); needs-upgrade (named registers, dot-repeat, gv, ~, r/R, text objects — biggest gap: operator-pending pipeline exists, operands are movements only); needs-new-machinery (ex command line — `:` taken by palette.command, macros, folding keymaps, :s regex, dot-repeat recording).
- O-P.3 DISCHARGED: K2/K5/K6 upgrade-decision probes — K2: matcher-gap fixture run (transpiled upstream text-matching tests vs nucleo adapter; camel-hump/prefix/order suspected); K5: chord-semantics conformance (keymap fixtures vs KeyMapLoader + chord-timeout table, fixed 1000ms today, count-vs-chord collisions); K6: driver ranking/selection traces via theorem-browser (live_oracle_required: true) comparing rank order + per-keystroke frame timing.
- g0 carry-forward informed: IME → browser (unproven, machinery exists both sides); GL fallback → browser view tier, orthogonal; one-frame budget → wasm in-register path (grammars stubbed on wasm — budget excludes highlighting); copy/paste → REAL browser gap (floem clipboard.rs documents web TODO — new web-sys adapter behind the existing Clipboard trait); a11y → deferred, focus model is the attach seam.
- K-lane surprises: VFS absorption lane already in-substrate (rustyred-thg-vfs — confirms manifest NO-GO row + d8); fork's modal keymap is a substantial Vim subset already (K8 = upgrade + gap-close, not port from zero); model/view split differs from manifest assumption (text model is floem_editor_core — K8 implementation_mode wording should change); clipboard on wasm is an upstream TODO (new-machinery for gate zero).

STATE: done. Evidence: `Theorem/docs/plans/intellij-absorption/P-L3-PROBE.md` (286 lines).
