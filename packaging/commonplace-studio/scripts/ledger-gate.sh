#!/bin/bash
# SOURCING: none. Twenty lines of file comparison; a policy engine for one rule
# would be more machinery than rule.
#
# SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7: "every patch has a ledger entry". Also
# guards the trademark boundary, because a Microsoft mark reaching product.json
# is a legal problem, not a style one.
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly LEDGER="$ROOT_DIR/LEDGER.md"
readonly OVERLAY="$ROOT_DIR/product.overlay.json"

failures=0

fail() {
    echo "ledger-gate: $*" >&2
    failures=$((failures + 1))
}

check_patches_are_documented() {
    local patch name count=0

    shopt -s nullglob
    for patch in "$ROOT_DIR/patches"/*.patch; do
        name="$(basename "$patch")"
        count=$((count + 1))
        if ! grep -q "$name" "$LEDGER"; then
            fail "$name has no LEDGER.md entry"
        fi
    done
    shopt -u nullglob

    if ! grep -q "^\*\*Patch count: $count\.\*\*$" "$LEDGER"; then
        fail "LEDGER.md does not report the real patch count ($count)"
    fi

    echo "ledger-gate: $count patch(es) in the queue"
}

check_no_microsoft_marks() {
    # Only the effective overlay matters: build.sh drops `_`-prefixed keys, so
    # the notes explaining *why* a key is set never reach product.json and must
    # not be scanned as though they had. The first version of this gate scanned
    # the raw file and failed on its own commentary.
    local effective
    effective="$(OVERLAY_PATH="$OVERLAY" node -e '
        const overlay = JSON.parse(require("fs").readFileSync(process.env.OVERLAY_PATH, "utf8"));
        const shipped = Object.fromEntries(
            Object.entries(overlay).filter(([key]) => !key.startsWith("_")),
        );
        process.stdout.write(JSON.stringify(shipped));
    ')"

    # The Open VSX resourceUrlTemplate carries Microsoft's asset path segment
    # because that segment is part of the gallery protocol both registries speak.
    # It is a wire path, not a mark, and Open VSX serves it.
    effective="${effective//Microsoft.VisualStudio.Code.WebResources/}"

    if grep -Eiq '(microsoft|visual studio code|vscode\.dev|vscode-cdn|update\.code\.visualstudio)' <<<"$effective"; then
        fail "product.overlay.json ships a Microsoft mark or endpoint"
    fi
}

check_telemetry_off() {
    grep -q '"enableTelemetry": false' "$OVERLAY" || fail "telemetry is not disabled in the overlay"
    grep -q 'open-vsx.org' "$OVERLAY" || fail "the overlay does not point at Open VSX"
}

main() {
    check_patches_are_documented
    check_no_microsoft_marks
    check_telemetry_off

    if [[ $failures -gt 0 ]]; then
        echo "ledger-gate: $failures failure(s)" >&2
        exit 1
    fi
    echo "ledger-gate: passed"
}

main "$@"
