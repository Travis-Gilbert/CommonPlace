#!/bin/bash
# SOURCING: none. Twenty lines of file comparison; a policy engine for one rule
# would be more machinery than rule.
#
# SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7: "every patch has a ledger entry". Also
# guards the trademark boundary, because a Microsoft mark reaching product.json
# is a legal problem, not a style one.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ROOT_DIR
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

# The overlay being right does not prove the merge took.
#
# `overlay_product` copies keys onto upstream's product.json, so a key upstream
# spells differently, or a merge that silently no-ops, leaves the shipped
# identity wrong while the overlay still reads correctly. This checks the file
# that actually ships, when there is one.
#
# Targeted rather than a blanket scan: upstream's product.json legitimately
# carries Microsoft strings in keys the fork does not override, such as trusted
# link domains. Grepping the whole file would fail on those and teach the reader
# to ignore the gate.
check_built_tree() {
    local built="$ROOT_DIR/build/vscode/product.json"

    if [[ ! -f "$built" ]]; then
        echo "ledger-gate: no built tree; run scripts/build.sh prepare to check the shipped product.json"
        return
    fi

    local report
    # shellcheck disable=SC2016  # The ${} here are JS template literals, and the
    # single quotes are what keeps the shell out of them.
    report="$(BUILT="$built" node -e '
        const product = JSON.parse(require("fs").readFileSync(process.env.BUILT, "utf8"));
        const problems = [];
        const expected = {
            nameShort: "Commonplace Studio",
            nameLong: "Commonplace Studio",
            applicationName: "commonplace-studio",
            dataFolderName: ".commonplace-studio",
            urlProtocol: "commonplace-studio",
            darwinBundleIdentifier: "dev.commonplace.studio",
            serverApplicationName: "commonplace-studio-server",
        };
        for (const [key, value] of Object.entries(expected)) {
            if (product[key] !== value) {
                problems.push(`${key} is ${JSON.stringify(product[key])}, expected ${JSON.stringify(value)}`);
            }
        }
        if (product.enableTelemetry !== false) problems.push("enableTelemetry is not false");
        if (product.updateUrl) problems.push(`updateUrl survived as ${JSON.stringify(product.updateUrl)}`);
        const gallery = product.extensionsGallery?.serviceUrl ?? "";
        if (!gallery.includes("open-vsx.org")) {
            problems.push(`extensionsGallery is ${JSON.stringify(gallery)}, expected Open VSX`);
        }
        process.stdout.write(problems.join("\n"));
    ')"

    if [[ -n "$report" ]]; then
        while IFS= read -r line; do
            fail "shipped product.json: $line"
        done <<<"$report"
        return
    fi
    echo "ledger-gate: the shipped product.json carries the fork identity"
}

main() {
    check_patches_are_documented
    check_no_microsoft_marks
    check_telemetry_off
    check_built_tree

    if [[ $failures -gt 0 ]]; then
        echo "ledger-gate: $failures failure(s)" >&2
        exit 1
    fi
    echo "ledger-gate: passed"
}

main "$@"
