#!/usr/bin/env bash
# Apply SPEC-THEOREM-CONTROL-PRIMITIVES-1.0 sources into a Theorem checkout.
# Usage:
#   ./patches/theorem-control-primitives/apply.sh /path/to/Theorem
# Expects Theorem root containing rustyredcore_THG/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
THEOREM_ROOT="${1:-}"

if [[ -z "${THEOREM_ROOT}" ]]; then
  for candidate in \
    /Theorem \
    "$(cd "${ROOT}/../../.." && pwd)/Theorem" \
    "$(cd "${ROOT}/../../../.." && pwd)/Theorem"
  do
    if [[ -d "${candidate}/rustyredcore_THG/crates/rustyred-thg-core" ]]; then
      THEOREM_ROOT="${candidate}"
      break
    fi
  done
fi

if [[ -z "${THEOREM_ROOT}" || ! -d "${THEOREM_ROOT}/rustyredcore_THG" ]]; then
  cat <<'EOF' >&2
Theorem checkout not found.

This environment's GitHub App installation can only see Travis-Gilbert/CommonPlace.
Add Travis-Gilbert/Theorem to the Cursor GitHub App repository access, then either:

  1. Re-run this agent with Theorem available as a sibling checkout, or
  2. Clone locally and run:

       git clone https://github.com/Travis-Gilbert/Theorem.git /Theorem
       ./patches/theorem-control-primitives/apply.sh /Theorem

EOF
  exit 1
fi

CORE="${THEOREM_ROOT}/rustyredcore_THG/crates/rustyred-thg-core/src"
MCP="${THEOREM_ROOT}/rustyredcore_THG/crates/rustyred-thg-mcp/src"

mkdir -p "${CORE}" "${MCP}"

install -m 0644 "${ROOT}/rustyred-thg-core/src/events.rs" "${CORE}/events.rs"
install -m 0644 "${ROOT}/rustyred-thg-core/src/event_log.rs" "${CORE}/event_log.rs"
install -m 0644 "${ROOT}/rustyred-thg-core/src/revisable.rs" "${CORE}/revisable.rs"
install -m 0644 "${ROOT}/rustyred-thg-mcp/src/webhooks.rs" "${MCP}/webhooks.rs"
install -m 0644 "${ROOT}/rustyred-thg-mcp/src/navigation.rs" "${MCP}/navigation.rs"
install -m 0644 "${ROOT}/rustyred-thg-mcp/src/step_schema.rs" "${MCP}/step_schema.rs"
install -m 0644 "${ROOT}/rustyred-thg-mcp/src/plan_validate.rs" "${MCP}/plan_validate.rs"
install -m 0644 "${ROOT}/INTEGRATION.md" "${THEOREM_ROOT}/CONTROL-PRIMITIVES-INTEGRATION.md"

echo "Installed CP1–CP6 sources under ${THEOREM_ROOT}"
echo "Next: follow CONTROL-PRIMITIVES-INTEGRATION.md for GraphStore, federation signing, and plan_substrate folds."
