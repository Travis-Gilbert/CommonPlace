#!/usr/bin/env bash
# SOURCING: none. Host-side C3/C4 for checkout consolidation.
# Run on the Mac that still has both clones. Safe by default: archive first,
# delete only with --delete.
#
# Usage:
#   bash scripts/retire-techdev-clone.sh           # archive + stub README
#   bash scripts/retire-techdev-clone.sh --delete  # also rm archived clone
#   bash scripts/retire-techdev-clone.sh --dry-run

set -euo pipefail

CANONICAL="${COMMONPLACE_CANONICAL:-/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace}"
TECHDEV="${COMMONPLACE_TECHDEV:-/Users/travisgilbert/Tech Dev Local/CommonPlace}"
SSD_WT="${COMMONPLACE_WORKTREES:-/Volumes/SSD Samsung/commonplace-worktrees}"
DATE_STAMP="$(date +%Y-%m-%d)"
ARCHIVE="${TECHDEV}.retired-${DATE_STAMP}"
DRY_RUN=0
DO_DELETE=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --delete) DO_DELETE=1 ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "DRY: $*"
  else
    "$@"
  fi
}

echo "Canonical: $CANONICAL"
echo "Tech Dev:  $TECHDEV"

if [[ ! -d "$CANONICAL" ]]; then
  echo "Canonical clone missing: $CANONICAL" >&2
  exit 1
fi
if [[ ! -f "$CANONICAL/apps/console/src/components/ground/MaterialLayer.tsx" ]]; then
  echo "Canonical clone lacks MaterialLayer; aborting." >&2
  exit 1
fi
if [[ ! -f "$CANONICAL/.commonplace-canonical" ]]; then
  echo "Canonical marker missing at $CANONICAL/.commonplace-canonical" >&2
  exit 1
fi

# Prefer a Creative tip that already carries the merged consolidation.
if git -C "$CANONICAL" rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "== ensure canonical tip knows origin/main =="
  run git -C "$CANONICAL" fetch origin main
fi

if [[ ! -d "$TECHDEV/.git" ]]; then
  echo "Tech Dev Local clone already gone or not a git repo: $TECHDEV"
  exit 0
fi

if [[ -e "$ARCHIVE" ]]; then
  echo "Archive already exists: $ARCHIVE" >&2
  echo "Refuse to continue so the live clone is not stubbed or deleted over an earlier archive." >&2
  exit 1
fi

echo "== prune prunable Tech Dev worktrees =="
if [[ -d "$TECHDEV" ]]; then
  while IFS= read -r line; do
    path="${line%% *}"
    if [[ "$path" == /private/tmp/cp-pr* ]] || [[ "$line" == *prunable* ]]; then
      echo "pruning $path"
      run git -C "$TECHDEV" worktree remove --force "$path" 2>/dev/null || true
    fi
  done < <(git -C "$TECHDEV" worktree list 2>/dev/null || true)
  run git -C "$TECHDEV" worktree prune 2>/dev/null || true
fi

echo "== push any local-only native-shell tip if present =="
if git -C "$TECHDEV" show-ref --verify --quiet refs/heads/Travis-Gilbert/commonplace-native-shell-backend; then
  run git -C "$TECHDEV" push -u origin Travis-Gilbert/commonplace-native-shell-backend
fi

echo "== rehome cohesive-turn-routing worktree under SSD if needed =="
run mkdir -p "$SSD_WT"
if git -C "$TECHDEV" show-ref --verify --quiet refs/heads/Travis-Gilbert/cohesive-turn-routing; then
  if ! git -C "$CANONICAL" show-ref --verify --quiet refs/remotes/origin/Travis-Gilbert/cohesive-turn-routing; then
    run git -C "$CANONICAL" fetch origin Travis-Gilbert/cohesive-turn-routing || true
  fi
  DEST="$SSD_WT/cohesive-turn-routing"
  if [[ ! -d "$DEST" ]] && git -C "$CANONICAL" show-ref --verify --quiet refs/remotes/origin/Travis-Gilbert/cohesive-turn-routing; then
    run git -C "$CANONICAL" worktree add "$DEST" Travis-Gilbert/cohesive-turn-routing || true
  fi
fi

echo "== archive Tech Dev Local clone =="
if [[ -d "$TECHDEV" ]]; then
  run mv "$TECHDEV" "$ARCHIVE"
fi

STUB_DIR="$TECHDEV"
if [[ ! -d "$STUB_DIR" ]]; then
  run mkdir -p "$STUB_DIR"
fi

STUB_BODY=$(cat <<EOF
# CommonPlace checkout retired

This path was a second full clone of Travis-Gilbert/CommonPlace.

Canonical home (MaterialLayer, island console):

  $CANONICAL

Do not open this directory as an agent workspace.
See docs/plans/console/37-CHECKOUT-CONSOLIDATION.md in the canonical clone.
EOF
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY: write stub README at $STUB_DIR/README.md"
else
  printf '%s\n' "$STUB_BODY" >"$STUB_DIR/README.md"
fi

if [[ "$DO_DELETE" -eq 1 && -d "$ARCHIVE" ]]; then
  echo "== deleting archive $ARCHIVE =="
  run rm -rf "$ARCHIVE"
fi

echo "Done. Open Cursor against: $CANONICAL"
