#!/usr/bin/env bash
# SPEC-THEOREM-BUILD-GRAPH-1.0 BG1 — fetch the pinned pane-host sidecar.
#
# Downloads the `pane-host` (or compatible theorem-browser) release assets named
# by apps/browser-native/browser-sidecar.pin, verifies every checksum, and
# installs each binary at apps/browser-native/binaries/pane-host-{triple}.
#
# The point of this script is that NO default CommonPlace desktop build compiles
# libservo. The Servo build cost is paid once per `browser-v*` tag in Theorem CI.
#
# Usage:
#   scripts/fetch-pane-host.sh                    # install the pinned tag
#   scripts/fetch-pane-host.sh --tag browser-v1.2 # install another tag
#   scripts/fetch-pane-host.sh --update           # record checksums in the pin
#   scripts/fetch-pane-host.sh --update --tag browser-v1.2
#
# Environment overrides:
#   PANE_HOST_PIN_FILE      pin to read (default apps/browser-native/browser-sidecar.pin)
#   PANE_HOST_BINARIES_DIR  install target (default apps/browser-native/binaries)
#   PANE_HOST_REPO          release source (default Travis-Gilbert/Theorem)
#   PANE_HOST_RELEASE_DIR   stage from a local directory instead of the network
#   PANE_HOST_ASSET_PREFIX  asset name prefix (default pane-host; fall back theorem-browser)
#
# Exits nonzero on: an unfilled pin, a download failure, a checksum mismatch, or
# a disagreement between the pin and the release's own .sha256 sidecar.
#
# Written for bash 3.2 (the macOS system bash): no mapfile, no associative
# arrays.

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PIN_FILE="${PANE_HOST_PIN_FILE:-${THEOREM_BROWSER_PIN_FILE:-$REPO_ROOT/apps/browser-native/browser-sidecar.pin}}"
readonly BINARIES_DIR="${PANE_HOST_BINARIES_DIR:-${THEOREM_BROWSER_BINARIES_DIR:-$REPO_ROOT/apps/browser-native/binaries}}"
readonly GITHUB_REPO="${PANE_HOST_REPO:-${THEOREM_BROWSER_REPO:-Travis-Gilbert/Theorem}}"
readonly RELEASE_DIR="${PANE_HOST_RELEASE_DIR:-${THEOREM_BROWSER_RELEASE_DIR:-}}"
readonly UNSET_SHA_HINT="run 'scripts/fetch-pane-host.sh --update' after the release is published, then commit the pin"

work_dir=""

cleanup() {
    if [[ -n "$work_dir" && -d "$work_dir" ]]; then
        rm -rf "$work_dir"
    fi
}
trap cleanup EXIT

log() {
    echo "[fetch-pane-host] $*" >&2
}

die() {
    echo "[fetch-pane-host] error: $*" >&2
    exit 1
}

usage() {
    sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

require_command() {
    local name=$1
    command -v "$name" >/dev/null 2>&1 || die "required command not found: $name"
}

# Emit the sha256 of a file as a bare hex digest.
sha256_of() {
    local file=$1
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}'
    else
        die "neither shasum nor sha256sum is available"
    fi
}

read_pinned_tag() {
    local tag
    tag="$(sed -n 's/^[[:space:]]*tag[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$PIN_FILE" | head -n 1)"
    [[ -n "$tag" ]] || die "no 'tag' entry in $PIN_FILE"
    printf '%s\n' "$tag"
}

# One "<triple> <sha256>" line per [[target]] block, in file order. A block with
# an empty sha256 yields an empty second field, which the caller refuses.
read_pinned_targets() {
    awk -F'"' '
        /^[[:space:]]*triple[[:space:]]*=/ { triple = $2; next }
        /^[[:space:]]*sha256[[:space:]]*=/ { print triple, $2 }
    ' "$PIN_FILE"
}

# Download one release asset into $work_dir. Prefers `gh` so the script works
# against a private repository; falls back to curl for public releases.
#
# PANE_HOST_RELEASE_DIR (or the legacy THEOREM_BROWSER_RELEASE_DIR alias) points
# the fetch at a local directory of release assets instead of the network. It
# exists so the checksum-verification paths are testable offline and an
# air-gapped install can stage assets by hand; verification is identical.
download_asset() {
    local tag=$1 asset=$2 dest_dir=$3 required=${4:-true}
    if [[ -n "$RELEASE_DIR" ]]; then
        local staged="${RELEASE_DIR}/${asset}"
        if [[ ! -f "$staged" ]]; then
            if [[ "$required" == true ]]; then
                die "staged asset not found: $staged"
            fi
            return 1
        fi
        cp "$staged" "$dest_dir/$asset"
        if [[ ! -s "$dest_dir/$asset" ]]; then
            if [[ "$required" == true ]]; then
                die "staged asset is empty: $asset"
            fi
            return 1
        fi
        return 0
    fi
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        if ! gh release download "$tag" \
            --repo "$GITHUB_REPO" \
            --pattern "$asset" \
            --dir "$dest_dir" \
            --clobber; then
            if [[ "$required" == true ]]; then
                die "gh could not download '$asset' from release '$tag' of $GITHUB_REPO"
            fi
            return 1
        fi
    else
        require_command curl
        local url="https://github.com/$GITHUB_REPO/releases/download/$tag/$asset"
        if ! curl --fail --silent --show-error --location "$url" --output "$dest_dir/$asset"; then
            if [[ "$required" == true ]]; then
                die "could not download $url (private repo? authenticate with 'gh auth login')"
            fi
            return 1
        fi
    fi
    if [[ ! -s "$dest_dir/$asset" ]]; then
        if [[ "$required" == true ]]; then
            die "downloaded asset is empty: $asset"
        fi
        return 1
    fi
}

# Verify the tarball against both the pin and the release's own .sha256 sidecar.
# Two independent records must agree before anything is installed.
verify_tarball() {
    local tarball=$1 expected=$2 sidecar=$3 asset_name=$4
    local actual sidecar_sha
    actual="$(sha256_of "$tarball")"

    if [[ "$actual" != "$expected" ]]; then
        die "checksum mismatch for $asset_name
  expected (browser-sidecar.pin): $expected
  actual   (downloaded artifact): $actual
Refusing to install an unverified sidecar."
    fi

    # The sidecar is the second independent record, so an absent or malformed one
    # is a verification failure, not a skip. Guarding on `-n` let an empty
    # .sha256 pass silently, which is exactly the case where the release side has
    # no checksum to disagree with.
    sidecar_sha="$(awk '{print $1}' "$sidecar" | head -n 1)"
    if [[ ! "$sidecar_sha" =~ ^[0-9a-fA-F]{64}$ ]]; then
        die "release .sha256 sidecar for $asset_name is missing or malformed
  read:   '${sidecar_sha}'
  expected a 64-character hex sha256
Refusing to install with only one checksum record."
    fi
    if [[ "$sidecar_sha" != "$actual" ]]; then
        die "release .sha256 sidecar disagrees with the downloaded artifact for $asset_name
  sidecar: $sidecar_sha
  actual:  $actual"
    fi
    log "verified $asset_name ($actual)"
}

install_target() {
    local tag=$1 triple=$2 expected=$3
    local prefix="${PANE_HOST_ASSET_PREFIX:-pane-host}"
    local asset="${prefix}-${triple}.tar.gz"
    local dest_dir="$work_dir/$triple"
    local binary_name="$prefix"
    mkdir -p "$dest_dir"

    log "downloading $asset from $tag"
    if ! download_asset "$tag" "$asset" "$dest_dir" false 2>/dev/null; then
        # Compatibility with Theorem's current release asset name.
        prefix="theorem-browser"
        asset="${prefix}-${triple}.tar.gz"
        binary_name="theorem-browser"
        log "falling back to $asset"
        download_asset "$tag" "$asset" "$dest_dir"
    fi
    download_asset "$tag" "${asset}.sha256" "$dest_dir"

    verify_tarball "$dest_dir/$asset" "$expected" "$dest_dir/${asset}.sha256" "$asset"

    tar -xzf "$dest_dir/$asset" -C "$dest_dir"
    [[ -f "$dest_dir/$binary_name" ]] || die "$asset did not contain a '$binary_name' binary"

    mkdir -p "$BINARIES_DIR"
    local installed="$BINARIES_DIR/pane-host-${triple}"
    mv -f "$dest_dir/$binary_name" "$installed"
    chmod 0755 "$installed"
    log "installed $installed (set PANE_HOST_BIN=$installed)"
}

# --update: download each asset, compute its checksum, and rewrite the pin.
update_pin() {
    local tag=$1
    local triple asset computed prefix
    local pin_tmp="$work_dir/browser-sidecar.pin"

    cp "$PIN_FILE" "$pin_tmp"
    sed -i.bak "s|^tag[[:space:]]*=.*|tag = \"$tag\"|" "$pin_tmp"
    rm -f "$pin_tmp.bak"

    while read -r triple _; do
        [[ -n "$triple" ]] || continue
        prefix="${PANE_HOST_ASSET_PREFIX:-pane-host}"
        asset="${prefix}-${triple}.tar.gz"
        mkdir -p "$work_dir/$triple"
        log "downloading $asset to record its checksum"
        if ! download_asset "$tag" "$asset" "$work_dir/$triple" false 2>/dev/null; then
            prefix="theorem-browser"
            asset="${prefix}-${triple}.tar.gz"
            log "falling back to $asset"
            download_asset "$tag" "$asset" "$work_dir/$triple"
        fi
        computed="$(sha256_of "$work_dir/$triple/$asset")"
        log "$triple -> $computed"
        # Rewrite only the sha256 line that follows this triple's block.
        awk -v want="$triple" -v sha="$computed" '
            /^[[:space:]]*triple[[:space:]]*=/ {
                split($0, parts, "\""); current = parts[2]
            }
            /^[[:space:]]*sha256[[:space:]]*=/ && current == want {
                print "sha256 = \"" sha "\""; next
            }
            { print }
        ' "$pin_tmp" > "$pin_tmp.next"
        mv -f "$pin_tmp.next" "$pin_tmp"
    done < <(read_pinned_targets)

    mv -f "$pin_tmp" "$PIN_FILE"
    log "updated $PIN_FILE for $tag — commit it"
}

main() {
    local tag_override="" do_update=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --tag)
                shift
                [[ $# -gt 0 ]] || die "--tag requires a value"
                tag_override="$1"
                ;;
            --update) do_update=true ;;
            -h|--help) usage 0 ;;
            *) die "unknown argument: $1 (try --help)" ;;
        esac
        shift
    done

    require_command tar
    require_command awk
    [[ -f "$PIN_FILE" ]] || die "pin file not found: $PIN_FILE"

    work_dir="$(mktemp -d "${TMPDIR:-/tmp}/commonplace-pane-host.XXXXXX")"

    local tag
    if [[ -n "$tag_override" ]]; then
        tag="$tag_override"
    else
        tag="$(read_pinned_tag)"
    fi
    log "release tag: $tag ($GITHUB_REPO)"

    if [[ "$do_update" == true ]]; then
        update_pin "$tag"
        return 0
    fi

    local triple expected installed_any=false
    while read -r triple expected; do
        [[ -n "$triple" ]] || continue
        if [[ -z "$expected" ]]; then
            die "browser-sidecar.pin has no sha256 for $triple — $UNSET_SHA_HINT"
        fi
        install_target "$tag" "$triple" "$expected"
        installed_any=true
    done < <(read_pinned_targets)

    [[ "$installed_any" == true ]] || die "no [[target]] blocks found in $PIN_FILE"
    log "done — no libservo was compiled"
}

main "$@"
