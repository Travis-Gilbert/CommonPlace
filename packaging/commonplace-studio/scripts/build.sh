#!/bin/bash
# SOURCING: VSCodium's prepare/build shape (clean upstream checkout, patch queue,
# product.json overlay, preinstalled extensions). Not vendored; this is the same
# sequence expressed against our own tree.
#
# SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7. Two outputs from one tree: the desktop
# app and the web workbench. The web path is `code serve-web` from this tree, not
# code-server's patch set, per the Verify-first decision recorded in README.md.
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
readonly BUILD_DIR="$ROOT_DIR/build/vscode"
readonly PACK_DIR="$REPO_DIR/apps/theorem-vscode"
readonly UPSTREAM_URL="https://github.com/microsoft/vscode.git"

log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

usage() {
    cat >&2 <<'EOF'
Usage: build.sh <desktop|web|prepare>

  prepare   Check out the pinned upstream tag, apply the patch queue, overlay
            product.json, and stage the Theorem pack. Idempotent.
  desktop   prepare, then build the desktop application.
  web       prepare, then build the web workbench (`code serve-web`).

Environment:
  UPSTREAM_TAG   Override the pinned tag in ../UPSTREAM_TAG.
EOF
    exit 1
}

require() {
    local tool=$1
    if ! command -v "$tool" &>/dev/null; then
        echo "Error: $tool is required and was not found" >&2
        exit 1
    fi
}

checkout_upstream() {
    local tag=$1

    if [[ ! -d "$BUILD_DIR/.git" ]]; then
        log "cloning upstream at $tag"
        mkdir -p "$(dirname "$BUILD_DIR")"
        git clone --depth 1 --branch "$tag" "$UPSTREAM_URL" "$BUILD_DIR"
        return
    fi

    log "resetting $BUILD_DIR to $tag"
    git -C "$BUILD_DIR" fetch --depth 1 origin "refs/tags/$tag:refs/tags/$tag" --force
    # Hard reset plus clean: the queue must apply to a pristine tree, or the
    # patch count stops meaning anything.
    git -C "$BUILD_DIR" checkout --force "refs/tags/$tag"
    git -C "$BUILD_DIR" reset --hard "refs/tags/$tag"
    git -C "$BUILD_DIR" clean -fdx -e node_modules
}

apply_patches() {
    local patch_dir="$ROOT_DIR/patches"
    local applied=0
    local patch

    shopt -s nullglob
    for patch in "$patch_dir"/*.patch; do
        log "applying $(basename "$patch")"
        git -C "$BUILD_DIR" apply --3way "$patch"
        applied=$((applied + 1))
    done
    shopt -u nullglob

    log "patch count: $applied"
    echo "$applied" > "$ROOT_DIR/build/patch-count.txt"
}

overlay_product() {
    log "overlaying product.json"
    UPSTREAM_PRODUCT="$BUILD_DIR/product.json" \
    OVERLAY="$ROOT_DIR/product.overlay.json" \
        node -e '
            const fs = require("fs");
            const target = process.env.UPSTREAM_PRODUCT;
            const base = JSON.parse(fs.readFileSync(target, "utf8"));
            const overlay = JSON.parse(fs.readFileSync(process.env.OVERLAY, "utf8"));
            for (const key of Object.keys(overlay)) {
                if (key.startsWith("_")) continue;
                base[key] = overlay[key];
            }
            fs.writeFileSync(target, `${JSON.stringify(base, null, "\t")}\n`);
        '
}

stage_pack() {
    local target="$BUILD_DIR/extensions/theorem-vscode"

    log "staging the Theorem pack as a preinstalled extension"
    (cd "$PACK_DIR" && npm run build)

    rm -rf "$target"
    mkdir -p "$target"
    cp "$PACK_DIR/package.json" "$target/package.json"
    cp -R "$PACK_DIR/dist" "$target/dist"
    if [[ -f "$REPO_DIR/LICENSE" ]]; then
        cp "$REPO_DIR/LICENSE" "$target/LICENSE"
    fi
}

prepare() {
    local tag="${UPSTREAM_TAG:-$(cat "$ROOT_DIR/UPSTREAM_TAG")}"

    require git
    require node
    require npm

    checkout_upstream "$tag"
    apply_patches
    overlay_product
    stage_pack
    log "prepared $BUILD_DIR at $tag"
}

build_desktop() {
    prepare
    log "building the desktop application"
    (cd "$BUILD_DIR" && npm ci && npm run gulp -- vscode-darwin-arm64-min)
}

build_web() {
    prepare
    log "building the web workbench"
    # `code serve-web` is served from the compiled web target; compile-web is the
    # step that produces it.
    (cd "$BUILD_DIR" && npm ci && npm run compile-web)
    log "run it with: (cd $BUILD_DIR && ./scripts/code-server.sh --launch)"
}

main() {
    case "${1:-}" in
        prepare) prepare ;;
        desktop) build_desktop ;;
        web) build_web ;;
        *) usage ;;
    esac
}

main "$@"
