#!/bin/bash
# Bundle the TheoremWeb host for the browser.
#
# The Dioxus CLI is not a dependency here: `dx` on this machine is Deno's `dx`,
# and pinning a second CLI to match `dioxus = "=0.7.10"` is more moving parts
# than the two commands this actually needs. wasm-bindgen is invoked directly,
# and the script refuses to run if the CLI drifts from the version the
# lockfile resolved, because that mismatch produces glue that fails only at
# runtime in the browser.
#
#   scripts/build-web.sh                        bundle to dist/
#   scripts/build-web.sh --with-local-registry  also stage the pinned contract
#
# --with-local-registry copies the oracle's pinned fixture to the path the host
# fetches, so a plain static server can stand in for the graph gateway. It is a
# local stand-in, never an authority: the canonical document is the backend's.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly APP_ROOT
readonly BIN_NAME="theoremweb"
readonly WASM_TARGET="wasm32-unknown-unknown"
readonly DIST_DIR="$APP_ROOT/dist"
readonly PINNED_CONTRACT="$APP_ROOT/oracles/fixtures/registry-contract-expected.json"
readonly PINNED_RECORDS="$APP_ROOT/oracles/fixtures/records-page-company.json"
# Must match src/main.rs REGISTRY_BASE, which appends /contract and
# /records/<surface_id>.
readonly REGISTRY_DIR="$DIST_DIR/api/theoremweb/registry"
readonly RECORDS_DIR="$REGISTRY_DIR/records"

with_local_registry=false
for arg in "$@"; do
    case "$arg" in
        --with-local-registry) with_local_registry=true ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

fail() {
    echo "build-web: $1" >&2
    exit 1
}

require_matching_wasm_bindgen() {
    command -v wasm-bindgen >/dev/null 2>&1 \
        || fail "wasm-bindgen is not on PATH; cargo install wasm-bindgen-cli --version $1"
    local installed
    installed="$(wasm-bindgen --version | awk '{print $2}')"
    [ "$installed" = "$1" ] \
        || fail "wasm-bindgen CLI is $installed but the lockfile resolved $1; the glue would fail at runtime"
}

locked_wasm_bindgen_version() {
    awk '/^name = "wasm-bindgen"$/ { found = 1; next }
         found && /^version = / { gsub(/[",]/, "", $3); print $3; exit }' \
        "$APP_ROOT/Cargo.lock"
}

cargo_target_dir() {
    cargo metadata --manifest-path "$APP_ROOT/Cargo.toml" --format-version 1 --no-deps \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"])'
}

main() {
    local locked_version
    locked_version="$(locked_wasm_bindgen_version)"
    [ -n "$locked_version" ] || fail "could not read the wasm-bindgen version from Cargo.lock"
    require_matching_wasm_bindgen "$locked_version"

    rustup target list --installed | grep -qx "$WASM_TARGET" \
        || fail "the $WASM_TARGET target is not installed; rustup target add $WASM_TARGET"

    echo "build-web: compiling $BIN_NAME for $WASM_TARGET"
    cargo build --release --target "$WASM_TARGET" --bin "$BIN_NAME" --manifest-path "$APP_ROOT/Cargo.toml"

    local target_dir wasm_artifact
    target_dir="$(cargo_target_dir)"
    wasm_artifact="$target_dir/$WASM_TARGET/release/$BIN_NAME.wasm"
    [ -f "$wasm_artifact" ] || fail "expected artifact is missing: $wasm_artifact"

    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"
    echo "build-web: generating glue with wasm-bindgen $locked_version"
    wasm-bindgen --target web --no-typescript \
        --out-dir "$DIST_DIR" --out-name "$BIN_NAME" "$wasm_artifact"

    cp "$APP_ROOT/index.html" "$DIST_DIR/index.html"

    if [ "$with_local_registry" = true ]; then
        [ -f "$PINNED_CONTRACT" ] || fail "pinned contract is missing: $PINNED_CONTRACT"
        [ -f "$PINNED_RECORDS" ] || fail "pinned record page is missing: $PINNED_RECORDS"
        mkdir -p "$RECORDS_DIR"
        cp "$PINNED_CONTRACT" "$REGISTRY_DIR/contract"
        # Keyed by surface id, matching records::fetch.
        cp "$PINNED_RECORDS" "$RECORDS_DIR/records"
        echo "build-web: staged the pinned contract and record page (local stand-ins only)"
    fi

    echo "build-web: wrote $DIST_DIR"
    ls -la "$DIST_DIR"
}

main "$@"
