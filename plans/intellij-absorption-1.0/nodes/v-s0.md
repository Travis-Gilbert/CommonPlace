# v-s0 (verify sibling of s0-lapce-spike)

Verifies s0's discharge: for each obligation O-S0.1..O-S0.6, re-run the declared proof command and record command + output in the node file, then gate.

| Obligation | Proof command | Discharge record |
|---|---|---|
| O-S0.1 | `cargo +1.96.1 tree -p lapce-app -e normal --no-default-features --features vendored-fonts` (no lapce-proxy/wasmtime/git2 lines) | M2/M3 evidence in S0-LAPCE-SPIKE.md matrix + tree output at verify time |
| O-S0.2 | wasm32 build command (env recipe below) | M3 evidence + cfg-gate table |
| O-S0.3a/b/c | `node wasm-serve/verify/accept2.js` (headed Chrome) with console + pixel report | acc-report.json + screenshots in wasm-serve/verify/ |
| O-S0.4 | Synthetic composition dispatch + screenshot note | IME observation paragraph |
| O-S0.5 | Read S0-LAPCE-SPIKE.md; all sections filled incl. bundle size (release + wasm-opt) | Section completeness check |
| O-S0.6 | Read board manifest/nodes/replay/CONTINUITY | State consistency check |

Proof env (wasm build): `CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"`, `CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"`, `RUSTFLAGS="-C link-arg=-L/tmp/wasi-sysroot/lib -C link-arg=-lc -C link-arg=--allow-undefined"`.

Verdicts: PASS/KILL per S0.1/S0.2/S0.3 written into the report with blockers as findings. Kill criteria: S0.1 seam failure, S0.2 upstream-fork-needed blockers, S0.3 floem wasm backend fails at app scale. Current status: S0.1 PASS, S0.2 PASS, S0.3 open (diagnosis in progress).
