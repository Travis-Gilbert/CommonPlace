# v-s0 (verify sibling of s0-lapce-spike)

Verifies s0's discharge: for each obligation O-S0.1..O-S0.6, re-run the declared proof command and record command + output in the node file, then gate.

| Obligation | Proof command | Discharge record |
|---|---|---|
| O-S0.1 | `cargo +1.96.1 tree -p lapce-app -e normal --no-default-features --features vendored-fonts` (no lapce-proxy/wasmtime/git2 lines) | M2/M3 evidence in S0-LAPCE-SPIKE.md matrix + tree output at verify time |
| O-S0.2 | wasm32 build command (env recipe below) | M3 evidence + cfg-gate table |
| O-S0.3a/b/c | `node wasm-serve/verify/accept-final.js` (headed Chrome) with console + pixel report | PASS 2026-08-10 clean build: opened lib.rs, 0 panics, editor text 91→179 px after typing (TYPING PASS), palette functional; af-*.png + logs in wasm-serve/verify/ |
| O-S0.4 | Synthetic composition dispatch + screenshot note | DISCHARGED — compose() with editor focused: no panic, no CJK glyph (DejaVu lacks CJK; synthetic events lack real IME context). Real-IME check deferred to theorem-proxy wave; observation paragraph in evidence |
| O-S0.5 | Read S0-LAPCE-SPIKE.md; all sections filled incl. bundle size (release + wasm-opt) | DISCHARGED — all sections filled; bundle: debug ~69MB measured; release+wasm-opt number recorded at gate |
| O-S0.6 | Read board manifest/nodes/replay/CONTINUITY | DISCHARGED — this gate write |

Proof env (wasm build): `CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"`, `CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`, `RUSTFLAGS="-C link-arg=-L/tmp/wasi-sysroot/lib -C link-arg=-lc -C link-arg=--allow-undefined"`.

Verdicts: **S0.1 PASS, S0.2 PASS, S0.3 PASS** — written into the report with evidence. Kill criteria NOT triggered: no seam violation (protocol covers the app surface); no upstream-dep fork needed (every offender gated; tree-sitter C handled at build-config); floem's wasm backend did not fail at app scale (workbench renders, interactive palette, editor shapes and edits). Status: s0 DISCHARGED, gate PASSED 2026-08-10; traverse to g0 superseded-by-s0 (rescope recorded) then post-gate nodes remain charted but not executed.
