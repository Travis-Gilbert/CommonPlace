#!/bin/bash
# SOURCING: VSCodium's prepare/build shape (clean upstream checkout, patch queue,
# product.json overlay, preinstalled extensions). Not vendored; this is the same
# sequence expressed against our own tree.
#
# SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7. Two outputs from one tree: the desktop
# app and the web workbench. The web path is `code serve-web` from this tree, not
# code-server's patch set, per the Verify-first decision recorded in README.md.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ROOT_DIR
REPO_DIR="$(cd "$ROOT_DIR/../.." && pwd)"
readonly REPO_DIR
# The upstream tree and the npm cache are the two things that make this build
# refuse to start. Both default to the repo, which normally sits on the boot
# volume, and `npm ci` plus `compile-web` wants ~15GiB of tree and ~8GiB of
# cache. Point STUDIO_BUILD_DIR at a roomier volume and the cache follows it,
# so clearing the floor is a variable rather than a machine cleanup. Artifacts
# outside the repo also stay out of git status.
BUILD_DIR="${STUDIO_BUILD_DIR:-$ROOT_DIR/build}/vscode"
readonly BUILD_DIR
readonly PACK_DIR="$REPO_DIR/apps/theorem-vscode"
readonly UPSTREAM_URL="https://github.com/microsoft/vscode.git"

# Keep patch-count and other build receipts beside the tree they describe.
BUILD_ROOT="$(dirname "$BUILD_DIR")"
readonly BUILD_ROOT

# npm's cache is the second floor. When the build tree has been relocated and
# the caller has not chosen a cache, put the cache on the same volume: a build
# volume with room and a cache volume without it still refuses.
if [[ -n "${STUDIO_BUILD_DIR:-}" && -z "${npm_config_cache:-}" ]]; then
    export npm_config_cache="$BUILD_ROOT/npm-cache"
fi

log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

usage() {
    cat >&2 <<'EOF'
Usage: build.sh <desktop|web|server|prepare>

  prepare   Check out the pinned upstream tag, apply the patch queue, overlay
            product.json, and stage the Theorem pack. Idempotent.
  desktop   prepare, then build the desktop application.
  web       prepare, then compile the web workbench for a local dev smoke.
  server    prepare, then build the deployable reh-web server. This is what
            the workspace image installs; `web` is a smoke target only.

Environment:
  UPSTREAM_TAG             Override the pinned tag in ../UPSTREAM_TAG.
  STUDIO_BUILD_DIR         Where the upstream tree is built. Must not contain
                           whitespace: node-gyp passes include paths to clang++
                           unquoted. Defaults to ./build beside this script.
  STUDIO_SERVER_PLATFORM   Server target platform (default linux).
  STUDIO_SERVER_ARCH       Server target arch (default x64).
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

# Free space on the volume holding a path, in GiB.
free_gib() {
    local target=$1
    while [[ ! -d "$target" ]]; do
        target="$(dirname "$target")"
    done
    df -g "$target" | awk 'NR==2 {print $4}'
}

# Refuse rather than fill a volume.
#
# `npm ci` on the upstream tree unpacks several GiB into the checkout and
# several more into the npm cache, which usually sits on the boot volume. A
# build that runs the boot volume to zero takes the machine's tooling with it,
# so both volumes are checked before either is written to.
require_disk() {
    local need_build=$1
    local need_cache=$2
    local build_free cache_free cache_dir

    build_free="$(free_gib "$BUILD_DIR")"
    cache_dir="$(npm config get cache)"
    cache_free="$(free_gib "$cache_dir")"

    if (( build_free < need_build )); then
        echo "Error: ${build_free}GiB free at $BUILD_DIR; this step needs ${need_build}GiB" >&2
        exit 1
    fi
    if (( cache_free < need_cache )); then
        echo "Error: ${cache_free}GiB free at $cache_dir; this step needs ${need_cache}GiB" >&2
        echo "Hint: npm cache clean --force, or set npm_config_cache to a roomier volume" >&2
        exit 1
    fi
    log "disk: ${build_free}GiB at the build tree, ${cache_free}GiB at the npm cache"
}

# Refuse a build path containing whitespace.
#
# Upstream's native modules build through node-gyp, which writes include paths
# into a Makefile unquoted and hands them to clang++ as-is. A single space in
# the tree path splits one argument into two, and the failure surfaces twenty
# minutes into `npm ci` as a missing directory named after the second half:
#
#   clang++: error: no such file or directory:
#     'Samsung/commonplace-studio-build/vscode/node_modules/@vscode/fs-copyfile/...'
#
# from a tree under "/Volumes/SSD Samsung". Nothing in the fork can fix that, so
# check it before the clone rather than after the compile. The npm cache is not
# subject to this: its path never reaches a compiler argument.
require_pathspace() {
    if [[ "$BUILD_DIR" =~ [[:space:]] ]]; then
        cat >&2 <<EOF
Error: the build tree path contains whitespace:
  $BUILD_DIR
node-gyp passes include paths to clang++ unquoted, so upstream's native modules
fail to compile from any path with a space in it.
Hint: STUDIO_BUILD_DIR=/some/space-free/path ./scripts/build.sh $1
EOF
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

# Upstream pins the toolchain node in .nvmrc and build/npm/preinstall.ts throws
# on a mismatched major. That throw lands inside `npm ci`, minutes after
# `prepare` has already reported success, so check it here where the tree is on
# disk and nothing expensive has started.
require_node_version() {
    local want_file="$BUILD_DIR/.nvmrc"
    [[ -f "$want_file" ]] || return 0

    local want have
    want="$(tr -d 'v \t\n' < "$want_file")"
    have="$(node -p 'process.versions.node')"

    if [[ "${want%%.*}" != "${have%%.*}" ]]; then
        cat >&2 <<EOF
Error: upstream $(cat "$ROOT_DIR/UPSTREAM_TAG") wants node ${want}, this shell has ${have}.
build/npm/preinstall.ts rejects a different major, so \`npm ci\` will fail.
Hint: nvm install ${want} && nvm use ${want}
EOF
        exit 1
    fi
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
    mkdir -p "$BUILD_ROOT"
    echo "$applied" > "$BUILD_ROOT/patch-count.txt"
}

overlay_product() {
    log "overlaying product.json"
    # shellcheck disable=SC2016  # The ${} here are JS template literals, and the
    # single quotes are what keeps the shell out of them.
    UPSTREAM_PRODUCT="$BUILD_DIR/product.json" \
    OVERLAY_PATH="$ROOT_DIR/product.overlay.json" \
        node -e '
            const fs = require("fs");
            const target = process.env.UPSTREAM_PRODUCT;
            const base = JSON.parse(fs.readFileSync(target, "utf8"));
            const overlay = JSON.parse(fs.readFileSync(process.env.OVERLAY_PATH, "utf8"));
            for (const key of Object.keys(overlay)) {
                if (key.startsWith("_")) continue;
                base[key] = overlay[key];
            }
            fs.writeFileSync(target, `${JSON.stringify(base, null, "\t")}\n`);
        '
}

stage_pack() {
    local target="$BUILD_DIR/extensions/theorem-vscode"

    # A Docker stage has already built the pack and has no pnpm workspace to
    # rebuild it from, so accept a prebuilt directory instead of running the
    # pack's own build. Same bytes either way; this only skips the compile.
    if [[ -n "${STUDIO_PACK_DIR:-}" ]]; then
        log "staging the prebuilt Theorem pack from $STUDIO_PACK_DIR"
        rm -rf "$target"
        mkdir -p "$(dirname "$target")"
        cp -R "$STUDIO_PACK_DIR" "$target"
        return
    fi

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
    require_pathspace prepare

    # The shallow checkout plus the staged pack. Measured at 1.131.0.
    require_disk 3 1
    checkout_upstream "$tag"
    require_node_version
    apply_patches
    overlay_product
    stage_pack
    log "prepared $BUILD_DIR at $tag"
}

build_desktop() {
    prepare
    require_disk 25 8
    log "building the desktop application"
    (cd "$BUILD_DIR" && npm ci && npm run gulp -- vscode-darwin-arm64-min)
}

build_web() {
    prepare
    require_disk 15 8
    log "building the web workbench"
    # `code serve-web` is served from the compiled web target; compile-web is the
    # step that produces it.
    (cd "$BUILD_DIR" && npm ci && npm run compile-web)
    log "run it with: (cd $BUILD_DIR && ./scripts/code-server.sh --launch)"
}

# The deployable server, which `web` alone does not produce.
#
# `compile-web` emits a development tree: scripts/code-server.sh runs it with
# VSCODE_DEV=1 and NODE_ENV=development against out/ and node_modules. That is a
# smoke target, not something to put in a container.
#
# What ships is upstream's reh-web target ("remote extension host, web"): a
# self-contained server directory with its own node, bin/${serverApplicationName},
# and the minified workbench. It is the same artifact code-server wraps, minus
# code-server's patch set, which is the whole point of the fork.
#
# Note the platform: the workspace image is linux, so a darwin host must pass
# STUDIO_SERVER_PLATFORM/ARCH or produce an artifact the container cannot run.
build_server() {
    local platform="${STUDIO_SERVER_PLATFORM:-linux}"
    local arch="${STUDIO_SERVER_ARCH:-x64}"
    local target="vscode-reh-web-${platform}-${arch}-min"
    # gulpfile.reh.ts emits into the parent of the source tree.
    local out="$BUILD_ROOT/vscode-reh-web-${platform}-${arch}"

    prepare
    # 15 is the measured `web` figure from RUNBOOK.md, which shares this compile.
    # The packaging step on top of it has not been measured yet; when it has,
    # replace this with the observed peak rather than another guess.
    require_disk 15 8
    log "building the server: $target"
    (cd "$BUILD_DIR" && npm ci && npm run gulp -- "$target")

    if [[ ! -x "$out/bin/commonplace-studio-server" ]]; then
        echo "Error: $out/bin/commonplace-studio-server is missing or not executable" >&2
        echo "The fork's serverApplicationName drives that filename; check product.overlay.json" >&2
        exit 1
    fi
    log "server at $out"
    log "smoke it with: $out/bin/commonplace-studio-server --host 127.0.0.1 --port 8080 --without-connection-token --accept-server-license-terms"
}

main() {
    case "${1:-}" in
        prepare) prepare ;;
        desktop) build_desktop ;;
        web) build_web ;;
        server) build_server ;;
        *) usage ;;
    esac
}

main "$@"
