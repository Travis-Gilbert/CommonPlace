#!/bin/bash
# SOURCING: VSCodium's rebase shape. Upstream ships monthly; this replays the
# queue against the new tag and reports divergence as a patch count.
#
# SPEC-COMMONPLACE-VSCODE-SURFACE-1.0 V7: "a rebase runbook against upstream's
# monthly cadence". This is the mechanical half; RUNBOOK.md is the rest.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ROOT_DIR
readonly BUILD_DIR="$ROOT_DIR/build/vscode"

log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

usage() {
    echo "Usage: rebase.sh <upstream-tag>    e.g. rebase.sh 1.132.0" >&2
    exit 1
}

main() {
    local tag="${1:-}"
    [[ -n "$tag" ]] || usage

    local previous
    previous="$(cat "$ROOT_DIR/UPSTREAM_TAG")"
    log "rebasing $previous -> $tag"

    # Dry run first: a queue that no longer applies must be reported, not
    # half-applied into a tree someone then builds and ships.
    UPSTREAM_TAG="$tag" "$SCRIPT_DIR/build.sh" prepare >/dev/null || {
        echo "Rebase failed: the patch queue does not apply cleanly to $tag." >&2
        echo "Fix or drop the failing patches, then update LEDGER.md." >&2
        exit 1
    }

    echo "$tag" > "$ROOT_DIR/UPSTREAM_TAG"

    local count
    count="$(cat "$ROOT_DIR/build/patch-count.txt")"
    local entries
    entries="$(grep -c '^| ' "$ROOT_DIR/LEDGER.md" || true)"

    cat <<EOF

Rebase complete.
  upstream:     $previous -> $tag
  patch count:  $count
  ledger rows:  $entries (including the candidates table header)
  tree:         $BUILD_DIR

Next: update LEDGER.md with anything the rebase changed, then run
  ./scripts/build.sh desktop
  ./scripts/build.sh web
EOF
}

main "$@"
