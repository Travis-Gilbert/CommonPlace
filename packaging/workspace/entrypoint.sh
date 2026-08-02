#!/usr/bin/env bash
# SOURCING: none. Pure process supervision, no upstream component applies.
#
# SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5: two doors, one checkout, one token.
#
# Both processes are started against the same ${WORKSPACE_DIR}. That is the
# whole mechanism: the chat register's file engine and the IDE register's
# explorer are reading the same inodes, so an edit through one is visible to
# the other with no sync step because there is no second copy to sync.
#
# Both also authenticate against ${WORKSPACE_TOKEN}. One secret, so revoking
# access closes both doors at once. Two secrets would mean a workspace whose
# IDE is still reachable after its chat access is withdrawn.

set -euo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/repo}"
OPENWORK_PORT="${OPENWORK_PORT:-8787}"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-8080}"

if [ -z "${WORKSPACE_TOKEN:-}" ]; then
  echo "workspace: WORKSPACE_TOKEN is required. Both doors authenticate against it." >&2
  echo "workspace: refusing to start rather than exposing an unauthenticated IDE." >&2
  exit 64
fi

mkdir -p "${WORKSPACE_DIR}"

# A fresh volume is an empty directory, not a repository. Both doors behave
# better against a real one (git status, diffs, the daemon's VCS reads), and
# an operator who mounts an existing checkout keeps theirs untouched.
if [ ! -d "${WORKSPACE_DIR}/.git" ]; then
  if [ -n "${WORKSPACE_REPO_URL:-}" ]; then
    # A private HTTPS clone URL can carry a deploy token in its userinfo.
    # Printing it publishes the credential to container logs, and git would
    # persist the same string as remote.origin.url on a volume any code-server
    # user can read, so the credential would outlive WORKSPACE_TOKEN and be
    # recoverable independently of it. Log a redacted form, and rewrite the
    # stored remote to the same URL without userinfo after cloning.
    redacted_url="$(printf '%s' "${WORKSPACE_REPO_URL}" | sed -E 's#(://)[^/@]*@#\1#')"
    echo "workspace: cloning ${redacted_url} into ${WORKSPACE_DIR}"
    git clone --depth "${WORKSPACE_CLONE_DEPTH:-1}" "${WORKSPACE_REPO_URL}" "${WORKSPACE_DIR}"
    git -C "${WORKSPACE_DIR}" remote set-url origin "${redacted_url}"
  else
    echo "workspace: initializing an empty repository at ${WORKSPACE_DIR}"
    git init --quiet "${WORKSPACE_DIR}"
  fi
fi

# The IDE door. --auth password reads PASSWORD from the environment, so the
# shared workspace token is what it checks.
export PASSWORD="${WORKSPACE_TOKEN}"

# The chat door. Both credentials are seeded, not just the host one: ordinary
# API routes authenticate bearer tokens against OPENWORK_TOKEN, and the web
# client deliberately withholds the host token from non-loopback servers. With
# only the host credential set, WORKSPACE_TOKEN opened the IDE and then got 401
# from every chat route.
export OPENWORK_TOKEN="${WORKSPACE_TOKEN}"
export OPENWORK_HOST_TOKEN="${WORKSPACE_TOKEN}"

# This container runs user and agent code and publishes a terminal through
# code-server. The console's cookie signing key is symmetric, so anything that
# can read this environment could mint a valid session for any subject, tenant,
# or workspace, not merely verify one. It must never be delivered here.
#
# Refuse to start rather than run in that state: the failure is silent
# otherwise, and a workspace that boots is a workspace someone will route
# traffic to. The console authenticates the user at its own edge and reaches
# this service with WORKSPACE_TOKEN, which is already scoped to one workspace.
if [ -n "${COMMONPLACE_ACTIVE_WORKSPACE_SECRET:-}" ]; then
  echo "workspace: COMMONPLACE_ACTIVE_WORKSPACE_SECRET is set in a workspace container." >&2
  echo "workspace: that key signs console sessions, so a terminal user here could forge" >&2
  echo "workspace: identities for other tenants. Remove it from this service's variables." >&2
  exit 78
fi

pids=()

shutdown() {
  # Kill the group, not one child: code-server forks, and leaving its extension
  # host alive holds the volume open and blocks a clean container restart.
  trap - TERM INT
  for pid in "${pids[@]}"; do
    kill -TERM "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
  done
  wait || true
}
trap shutdown TERM INT

echo "workspace: chat door on :${OPENWORK_PORT}, IDE door on :${CODE_SERVER_PORT}, both over ${WORKSPACE_DIR}"

setsid code-server \
  --bind-addr "0.0.0.0:${CODE_SERVER_PORT}" \
  --auth password \
  --disable-telemetry \
  --disable-update-check \
  "${WORKSPACE_DIR}" &
pids+=($!)

# --workspace, not --dir: the daemon's flag is a repeatable workspace root
# (apps/chat-server/src/config.ts). The token rides the environment rather than
# --host-token so it never appears in the container's process list.
setsid openwork-server \
  --host 0.0.0.0 \
  --port "${OPENWORK_PORT}" \
  --workspace "${WORKSPACE_DIR}" &
pids+=($!)

# Exit when either door dies. A container running half its contract is worse
# than one that restarts: the console's healthcheck sees a live chat door and
# keeps routing to a workspace whose IDE is gone.
# `wait -n` returns the exited child's status, and under `set -e` a nonzero
# status would terminate the script here, so shutdown would never run and the
# surviving door would die with the container instead of receiving TERM.
#
# `|| status=$?` is errexit-safe and keeps the status. `if ! wait -n` is not:
# the `!` inverts the result, so `$?` inside the branch is the negation's own
# status, which is 0. The entrypoint would then exit successfully after any
# door failure and Railway's ON_FAILURE policy would never restart it.
status=0
wait -n || status=$?
echo "workspace: a door exited with ${status}; stopping the other" >&2
shutdown
exit "${status}"
