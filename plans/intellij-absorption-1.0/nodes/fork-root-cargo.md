# theorem-ide fork workspace root — PRUNED at ws-merge (intellij-absorption-1.0, O-M.1).
#
# The four crates (lapce-app, lapce-proxy, lapce-rpc, lapce-core) were moved into
# rustyredcore_THG/crates/ as theorem-ide-app / theorem-ide-proxy / theorem-ide-rpc /
# theorem-ide-core (rename table + patch/floem-pin resolution:
# Theorem/docs/plans/intellij-absorption/WS-MERGE.md). The floem git pin
# (31fa8f444c37f4c314f47d88c23ffdbc25f2ab53), the fork's [patch.crates-io] entries,
# and its workspace deps/profiles travel in the substrate workspace root.
#
# This directory keeps wasm-serve (re-pointed at the merged crate), defaults,
# extra/fonts, verify harness, docs, icons, themes, and the upstream LICENSE/
# README. It no longer builds anything itself: the wasm frontend is built from
# the substrate via wasm-serve/build-wasm.sh (`-p theorem-ide-app --bin theorem_ide_wasm`).
[workspace]
members = []
resolver = "2"
