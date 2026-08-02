#!/usr/bin/env bash
# Conformance gate for SPEC-COMMONPLACE-OPENWORK-FORK-1.0.
#
# Asserts the eight named choices and the anti-scope lines mechanically rather
# than from memory. Runs at OW1 and again before OW7 closes, and must be re-run
# after every upstream cherry-pick — upstream legitimately contains Den
# endpoints, telemetry, and the hosted model catalog, so a clean cherry-pick can
# reintroduce any of them.
#
# Exit 0 = clean. Exit 1 = at least one check failed.
#
# Usage: scripts/audit-openwork-fork.sh

set -uo pipefail
cd "$(dirname "$0")/.."

FORK_APPS="apps/chat apps/chat-server"
FORK_PKGS="packages/openwork-ui packages/openwork-types packages/openwork-paths"
FORK_ALL="$FORK_APPS $FORK_PKGS"
SRC_ONLY=(--glob '!*.test.*' --glob '!**/tests/**' --glob '!**/scripts/**' --glob '!*.md')

fails=0
pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; fails=$((fails + 1)); }
note() { printf '        %s\n' "$1"; }

# A check "passes" when ripgrep finds nothing (rg exits 1 on no match).
#
# Comment lines are stripped before judging. MODIFICATIONS.md requires the fork
# to *document* what was severed, and that prose necessarily names the very
# hosts and flags these checks forbid. Matching comments would make honest
# documentation indistinguishable from a regression, which is backwards: the
# audit exists to catch live code, not the record of its removal.
strip_comments() { grep -vE '^[^:]+:[0-9]+: *(\*|//|/\*|#)'; }

refute() { # refute <label> <pattern> [paths...]
  local label="$1" pattern="$2"; shift 2
  local hits
  hits="$(rg -n --no-heading "${SRC_ONLY[@]}" "$pattern" "$@" 2>/dev/null | strip_comments)"
  if [ -z "$hits" ]; then
    pass "$label"
  else
    fail "$label"
    printf '%s\n' "$hits" | head -8 | sed 's/^/          /'
  fi
}

echo "SPEC-COMMONPLACE-OPENWORK-FORK-1.0 conformance audit"
echo

echo "Named choice 7 — the Fair Source bright line is mechanical"
refute "no import resolves into /ee or enterprise-mcp" \
  "from ['\"][^'\"]*(\bee/|enterprise-mcp)" $FORK_ALL
if [ -d ee ] || ls -d ./*enterprise-mcp* >/dev/null 2>&1; then
  fail "no /ee or enterprise-mcp directory exists in the repo"
else
  pass "no /ee or enterprise-mcp directory exists in the repo"
fi

echo
echo "Named choice 4 — Den is severed day one"
refute "no openworklabs.com host in fork source" "openworklabs\.com" $FORK_ALL
refute "no PostHog telemetry host or key" "posthog|phc_[A-Za-z0-9]" $FORK_ALL
refute "no Den sign-in flag read from env" "VITE_DEN_REQUIRE_SIGNIN" $FORK_ALL
refute "no Den sign-in flag in any build script" "VITE_DEN_REQUIRE_SIGNIN" \
  apps/chat/package.json apps/chat-server/package.json
refute "no telemetry ingest path" "/v1/telemetry/ingest" $FORK_ALL

echo
echo "Anti-scope — no port of the chat register into Next App Router"
if [ -e apps/chat/next.config.js ] || [ -e apps/chat/next.config.mjs ] \
   || [ -e apps/chat/next.config.ts ] || [ -d apps/chat/src/app/\(routes\) ]; then
  fail "chat register is still a Vite app (no Next config present)"
else
  pass "chat register is still a Vite app (no Next config present)"
fi
if [ -f apps/chat/vite.config.ts ] || [ -f apps/chat/vite.config.mts ]; then
  pass "vite config present"
else
  fail "vite config present"
fi

echo
echo "Anti-scope — apps/desktop is parked, neither adopted nor deleted"
if grep -q 'apps/desktop' apps/chat/UPSTREAM.md 2>/dev/null; then
  pass "apps/desktop disposition recorded in UPSTREAM.md"
else
  fail "apps/desktop disposition recorded in UPSTREAM.md"
fi
if [ -d apps/chat/../desktop ] && [ ! -e apps/chat-desktop ]; then
  note "note: apps/desktop in this repo is CommonPlace's own, not the vendored Electron wrapper"
fi

echo
echo "Named choice 1 — provenance is pinned and divergence is recorded"
for f in apps/chat/UPSTREAM.md apps/chat/MODIFICATIONS.md apps/chat/NOTICE; do
  [ -f "$f" ] && pass "$f exists" || fail "$f exists"
done
for d in $FORK_ALL; do
  [ -f "$d/LICENSE" ] && pass "$d/LICENSE preserved" || fail "$d/LICENSE preserved"
done
if grep -qE '^\| Commit \| `[0-9a-f]{40}` \|' apps/chat/UPSTREAM.md 2>/dev/null; then
  pass "UPSTREAM.md pins a full 40-character commit sha"
else
  fail "UPSTREAM.md pins a full 40-character commit sha"
fi

echo
echo "OW6 — no engine surgery before the seam audit exists"
if [ -f docs/plans/console/openwork-fork/02-SEAM-AUDIT.md ]; then
  pass "seam audit report exists"
  if grep -q 'Stay on the opencode head' docs/plans/console/openwork-fork/02-SEAM-AUDIT.md; then
    pass "seam audit carries a named stage-two decision"
  else
    fail "seam audit carries a named stage-two decision"
  fi
else
  fail "seam audit report exists"
fi
# Stage one is the opencode head. A second transport appearing before the audit
# says otherwise would be engine surgery.
refute "no transport other than @opencode-ai/sdk constructs sessions" \
  "createTheoremSessionClient|theorem-native-session" $FORK_ALL

echo
echo "Named choice 5 / OW3 — one token truth, no design decisions in fork components"
refute "no raw hex colors in fork component source" \
  "#[0-9a-fA-F]{6}\b" apps/chat/src/react-app apps/chat/src/components
refute "no raw oklch() literals in fork component source" \
  "oklch\(" apps/chat/src/react-app apps/chat/src/components

echo
echo "OW3 — the token truth is generated, not hand-maintained"
if node apps/chat/scripts/check-console-register.mjs >/dev/null 2>&1; then
  pass "console-register.css matches the console registers"
else
  fail "console-register.css matches the console registers"
  note "run: pnpm --filter @commonplace/chat tokens"
fi
# An undefined custom property is dropped silently, so a removed token leaves
# no trace in typecheck, build, or a screenshot of a surface that does not use
# it. OW3 shipped exactly that bug across thirteen call sites.
if node apps/chat/scripts/check-token-references.mjs >/dev/null 2>&1; then
  pass "every --dls/--ij/--cp/--gy/--ow token used is also defined"
else
  fail "every --dls/--ij/--cp/--gy/--ow token used is also defined"
fi
if node apps/chat/scripts/check-shader-mounts.mjs >/dev/null 2>&1; then
  pass "exactly one shader mount in the chat register"
else
  fail "exactly one shader mount in the chat register"
fi
# Named choice 5 forbids a second design authority. A per-organization accent
# written onto the register at runtime is exactly that, whatever it is called.
refute "no runtime override of a register token" \
  "setProperty\(\s*['\"]--(ij|cp|gy|dls)-" $FORK_ALL

echo
echo "Named choice 4 / OW4 — the console session replaces Den sign-in"
for f in apps/chat-server/src/console-session.ts apps/chat/src/react-app/shell/console-session-gate.tsx; do
  [ -f "$f" ] && pass "$f exists" || fail "$f exists"
done
# The daemon verifies sessions; it must never be able to mint one.
refute "the workspace daemon never signs a console session" \
  "encodeActiveWorkspaceClaims|createHmac\([^)]*\)\s*\.update\(\s*['\"]commonplace-active-workspace" \
  apps/chat-server/src

echo
echo "Named choice 6 / OW5 — one workspace container, two doors"
if [ -f packaging/workspace/Dockerfile ] && [ -f packaging/workspace/entrypoint.sh ]; then
  pass "workspace image and entrypoint exist"
  if node packaging/workspace/check-two-doors.mjs >/dev/null 2>&1; then
    pass "two doors resolve to one checkout and one token"
  else
    fail "two doors resolve to one checkout and one token"
  fi
else
  fail "workspace image and entrypoint exist"
fi
# The image installs with --frozen-lockfile, which fails hard when the lockfile
# and any package.json disagree. That failure surfaces only when the image is
# built, and nothing in this repo builds it on every change, so a dependency
# edit committed without its lockfile stays green here and breaks the deploy.
# This is the check that would have caught exactly that (it did, once).
if pnpm install --frozen-lockfile --lockfile-only >/dev/null 2>&1; then
  pass "lockfile satisfies --frozen-lockfile (what the image build runs)"
else
  fail "lockfile satisfies --frozen-lockfile (what the image build runs)"
  note "run: pnpm install, and commit pnpm-lock.yaml with the package.json change"
fi

echo
echo "Anti-scope — no artifact blob store treated as semantic truth"
refute "no artifact table in the daemon schema" \
  "sqliteTable\(\s*['\"](artifacts|messages|sessions)" apps/chat-server
echo
echo "----------------------------------------------------------------"
if [ "$fails" -eq 0 ]; then
  echo "PASS — all conformance checks clean"
  exit 0
fi
echo "FAIL — $fails conformance check(s) failed"
exit 1
