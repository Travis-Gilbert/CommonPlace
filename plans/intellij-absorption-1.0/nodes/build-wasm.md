#!/bin/sh
# S0.3 wasm build pipeline (manual; trunk's loader can't pass the WASI import
# object). Reproduces the S0.2 gate recipe exactly, then wasm-bindgen, a glue
# patch for the wasi imports, and wasm-opt.
#
# ws-merge (intellij-absorption-1.0, O-M.1): the fork's crates merged into the
# rustyredcore_THG workspace, so this builds `-p theorem-ide-app --bin
# theorem_ide_wasm` from the substrate (--manifest-path; the fork workspace is
# pruned and builds nothing). CARGO_TARGET_DIR / CARGO_HOME default to the
# theorem-ide .target / .cargo-home so builds never land on the full SSD that
# the global ~/.cargo config points at.
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"            # .../theorem-ide/lapce/wasm-serve
FORK="$(cd "$HERE/.." && pwd)"                   # .../theorem-ide/lapce
IDE="$(cd "$HERE/../.." && pwd)"                 # .../theorem-ide
SUBSTRATE="$(cd "$IDE/../rustyredcore_THG" && pwd)"  # .../Theorem/rustyredcore_THG
cd "$FORK"

export CC_wasm32_unknown_unknown="/opt/homebrew/opt/llvm/bin/clang --sysroot=/tmp/wasi-sysroot"
export CFLAGS_wasm32_unknown_unknown="-Wno-implicit-function-declaration"
export RUSTFLAGS="-C link-arg=-L/tmp/wasi-sysroot/lib -C link-arg=-lc -C link-arg=--allow-undefined"

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$IDE/.target}"
export CARGO_HOME="${CARGO_HOME:-$IDE/.cargo-home}"

# ws-transport: default features now build the ws-proxy client (real
# proxy over websocket); override with FEATURES=... for the stub build.
FEATURES="${FEATURES:-vendored-fonts,ws-proxy}"
cargo +1.96.1 build --manifest-path "$SUBSTRATE/Cargo.toml" -p theorem-ide-app --bin theorem_ide_wasm \
  --target wasm32-unknown-unknown \
  --release --no-default-features --features "$FEATURES"

WASM="$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/theorem_ide_wasm.wasm"
wasm-bindgen "$WASM" --target web --out-dir "$HERE" --no-typescript

cd "$HERE"
python3 patch-glue.py
wasm-opt -Oz theorem_ide_wasm_bg.wasm -o theorem_ide_wasm_bg.wasm
echo "bundle: $(wc -c < theorem_ide_wasm_bg.wasm) bytes (wasm-opt -Oz)"
