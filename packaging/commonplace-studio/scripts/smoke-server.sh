#!/bin/bash
# SOURCING: none. CS-002. RUNBOOK section 5's web bullets, expressed as
# assertions instead of a human reading a screen: the server boots, the fork
# identity is what it serves, the gallery is Open VSX, telemetry is off, and the
# Theorem pack ships inside the artifact rather than being installed by hand.
#
# This covers everything checkable without a browser. Activation inside the
# browser extension host is the one bullet a shell cannot prove; the receipt
# records it as a separate line, filled in from a real page load.
set -euo pipefail

# The container is the real target, and the way in is
#   railway ssh 'bash -s' < scripts/smoke-server.sh
# which leaves BASH_SOURCE empty, so under `set -u` deriving the root from it
# aborted before a single check ran. The default is only a convenience for a
# local build tree anyway: STUDIO_SERVER_DIR names the artifact directly, and
# that is the form the image uses.
SCRIPT_DIR=$PWD
if [[ -n ${BASH_SOURCE[0]:-} ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
readonly SCRIPT_DIR
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ROOT_DIR
BUILD_ROOT="${STUDIO_BUILD_DIR:-$ROOT_DIR/build}"
readonly BUILD_ROOT

PLATFORM="${STUDIO_SERVER_PLATFORM:-linux}"
ARCH="${STUDIO_SERVER_ARCH:-x64}"
SERVER_DIR="${STUDIO_SERVER_DIR:-$BUILD_ROOT/vscode-reh-web-${PLATFORM}-${ARCH}}"
readonly PLATFORM ARCH SERVER_DIR
readonly SERVER_BIN="$SERVER_DIR/bin/commonplace-studio-server"

log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

FAILURES=0
pass() { echo "  ok    $*"; }
fail() { echo "  FAIL  $*"; FAILURES=$((FAILURES + 1)); }

# `pass` always succeeds, so `test && pass || fail` would never reach fail.
# Spell the branch out instead.
expect() {
    local label=$1 actual=$2 wanted=$3
    if [[ "$actual" == "$wanted" ]]; then
        pass "$label is $actual"
    else
        fail "$label is '$actual', wanted '$wanted'"
    fi
}

expect_unset() {
    local label=$1 actual=$2
    if [[ -z "$actual" || "$actual" == "null" ]]; then
        pass "$label unset"
    else
        fail "$label is '$actual'"
    fi
}

indent() {
    local line
    while IFS= read -r line; do
        echo "          $line"
    done
}

WORK_DIR=""
SERVER_PID=""
cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]] && rm -rf "$WORK_DIR"
    return 0
}
trap cleanup EXIT

# A reh-web artifact only runs on the platform it was built for. Building linux
# on a mac is the normal case here (the workspace image is linux), so say so
# rather than booting a binary that cannot exec.
host_platform() {
    case "$(uname -s)" in
        Darwin) echo darwin ;;
        Linux) echo linux ;;
        *) echo unknown ;;
    esac
}

json_get() {
    node -e '
        const fs = require("fs");
        const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const value = process.argv[2].split(".").reduce((o, k) => (o == null ? o : o[k]), doc);
        process.stdout.write(value === undefined ? "" : String(value));
    ' "$1" "$2"
}

check_artifact() {
    echo "artifact"
    if [[ ! -d "$SERVER_DIR" ]]; then
        fail "no server directory at $SERVER_DIR (run build.sh server first)"
        return 1
    fi
    pass "server directory $SERVER_DIR"
    if [[ ! -x "$SERVER_BIN" ]]; then
        fail "launcher missing or not executable: $SERVER_BIN"
        return 1
    fi
    pass "launcher $SERVER_BIN"
    return 0
}

check_identity() {
    echo "identity, gallery, telemetry"
    local product="$SERVER_DIR/product.json"
    if [[ ! -f "$product" ]]; then
        fail "no product.json in the artifact"
        return
    fi

    local name_long app_name server_app
    name_long="$(json_get "$product" nameLong)"
    app_name="$(json_get "$product" applicationName)"
    server_app="$(json_get "$product" serverApplicationName)"
    expect nameLong "$name_long" "Commonplace Studio"
    expect applicationName "$app_name" "commonplace-studio"
    expect serverApplicationName "$server_app" "commonplace-studio-server"

    local telemetry opt_out
    telemetry="$(json_get "$product" enableTelemetry)"
    opt_out="$(json_get "$product" telemetryOptOut)"
    expect enableTelemetry "$telemetry" false
    expect telemetryOptOut "$opt_out" true

    local gallery
    gallery="$(json_get "$product" extensionsGallery.serviceUrl)"
    if [[ "$gallery" == *"open-vsx.org"* ]]; then
        pass "gallery is Open VSX ($gallery)"
    else
        fail "gallery serviceUrl is '$gallery'"
    fi

    # A fork that still points at Microsoft's services is the failure this whole
    # overlay exists to prevent, so grep the shipped file rather than trusting
    # the keys we happen to have named above.
    local microsoft_hits
    microsoft_hits="$(grep -oE 'https://[a-zA-Z0-9./-]*(microsoft|visualstudio|vscode-cdn)[a-zA-Z0-9./-]*' "$product" | sort -u || true)"
    if [[ -z "$microsoft_hits" ]]; then
        pass "no Microsoft service URLs in product.json"
    else
        fail "product.json still points at Microsoft services:"
        indent <<< "$microsoft_hits"
    fi

    local update_url sync_store voice_url chat_agent
    update_url="$(json_get "$product" updateUrl)"
    sync_store="$(json_get "$product" configurationSync.store)"
    voice_url="$(json_get "$product" voiceWsUrl)"
    chat_agent="$(json_get "$product" defaultChatAgent)"
    expect_unset updateUrl "$update_url"
    expect_unset "configurationSync.store" "$sync_store"
    expect_unset voiceWsUrl "$voice_url"
    expect_unset defaultChatAgent "$chat_agent"

    if grep -Eiq 'GitHub\.copilot|aka\.ms/github-copilot|falcon-caas\.mai\.microsoft' "$product"; then
        fail "product.json still names Copilot or Microsoft Copilot endpoints"
    else
        pass "no Copilot / Microsoft Copilot endpoints in product.json"
    fi

    if [[ -d "$SERVER_DIR/extensions/copilot" ]]; then
        fail "upstream built-in copilot extension still present under $SERVER_DIR/extensions/copilot"
    else
        pass "upstream built-in copilot extension is not shipped"
    fi
}

check_pack() {
    echo "theorem pack"
    local manifest="$SERVER_DIR/extensions/theorem-vscode/package.json"
    if [[ ! -f "$manifest" ]]; then
        fail "pack not staged into the artifact ($manifest)"
        return
    fi
    local id publisher name
    publisher="$(json_get "$manifest" publisher)"
    name="$(json_get "$manifest" name)"
    id="$publisher.$name"
    pass "pack ships as a built-in: $id"

    # The pack registers no search providers without this grant, and the failure
    # is silent: VS Code's ripgrep search simply stands. Named choice 8.
    local grant
    grant="$(json_get "$SERVER_DIR/product.json" "extensionEnabledApiProposals.$id")"
    if [[ -n "$grant" ]]; then
        pass "proposed API grant present: $grant"
    else
        fail "no extensionEnabledApiProposals entry for $id"
    fi

    if [[ -f "$SERVER_DIR/extensions/theorem-vscode/dist/extension.js" ]] ||
        [[ -n "$(json_get "$manifest" browser)" ]]; then
        pass "pack carries a web entry point"
    else
        fail "pack has no browser entry point, so the web host cannot activate it"
    fi
}

check_boot() {
    echo "boot"
    local host_os
    host_os="$(host_platform)"
    if [[ "$host_os" != "$PLATFORM" ]]; then
        echo "  skip  built for $PLATFORM, this host is $host_os; boot runs in the image"
        return
    fi

    WORK_DIR="$(mktemp -d)"
    mkdir -p "$WORK_DIR/data" "$WORK_DIR/extensions" "$WORK_DIR/folder"
    printf 'smoke\n' > "$WORK_DIR/folder/README.md"

    local server_log="$WORK_DIR/server.log"
    env -u PORT "$SERVER_BIN" \
        --host 127.0.0.1 \
        --port 0 \
        --without-connection-token \
        --accept-server-license-terms \
        --server-data-dir "$WORK_DIR/data" \
        --extensions-dir "$WORK_DIR/extensions" \
        --default-folder "$WORK_DIR/folder" \
        > "$server_log" 2>&1 &
    SERVER_PID=$!

    local url=""
    for _ in $(seq 1 60); do
        if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
        url="$(grep -oE 'http://(127\.0\.0\.1|localhost):[0-9]+' "$server_log" | head -1 || true)"
        [[ -n "$url" ]] && break
        sleep 1
    done

    if [[ -z "$url" ]]; then
        fail "server never advertised a URL; last log lines:"
        tail -12 "$server_log" | indent
        return
    fi
    pass "listening at $url"

    local body="$WORK_DIR/root.html"
    local status
    status="$(curl -sS -o "$body" -w '%{http_code}' "$url/" || echo 000)"
    expect "GET /" "$status" 200

    if grep -q "Commonplace Studio" "$body"; then
        pass "served workbench carries the fork name"
    else
        fail "served workbench does not name Commonplace Studio"
    fi
    if grep -qi "Visual Studio Code" "$body"; then
        fail "served workbench still carries Visual Studio Code branding"
    else
        pass "no Visual Studio Code branding in the served workbench"
    fi

    echo "$url" > "$WORK_DIR/url"
    echo "  note  browser activation check: load $url and read the extension host log"
}

main() {
    log "smoking $SERVER_DIR"
    if check_artifact; then
        check_identity
        check_pack
        check_boot
    fi

    echo
    if (( FAILURES == 0 )); then
        log "smoke passed"
        return 0
    fi
    log "smoke failed: $FAILURES check(s)"
    return 1
}

main "$@"
