#!/usr/bin/env bash
# SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL4.
# Spec path is scripts/doctor.sh; implementation is the Node observer beside it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/doctor.mjs" "$@"
