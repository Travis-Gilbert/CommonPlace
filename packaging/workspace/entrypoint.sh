#!/usr/bin/env bash
# SOURCING: none. Pure process supervision, no upstream component applies.
#
# SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5: two doors, one checkout, one token.
# IDE-006 adds a third process: co-located commonplace-api over the same
# ${WORKSPACE_DIR} so theorem-vscode can query live diagnostics.
#
# Both processes are started against the same ${WORKSPACE_DIR}. That is the
# whole mechanism: the chat register's file engine and the IDE register's
# explorer are reading the same inodes, so an edit through one is visible to
# the other with no sync step because there is no second copy to sync.
#
# Chat authenticates against ${WORKSPACE_TOKEN}. The IDE door runs --auth none
# on the private network; the console /IDE edge checks cp_active_workspace and
# is the only public path to :8080. Revoking WORKSPACE_TOKEN still closes chat;
# revoking the active-workspace cookie closes the IDE edge.

set -euo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace/repo}"
# Railway healthchecks and public routing use $PORT. The chat door owns that
# port. code-server also reads $PORT and will ignore --bind-addr when it is set,
# so it must be started with PORT unset (GL7 collision 2026-08-03).
OPENWORK_PORT="${OPENWORK_PORT:-${PORT:-8787}}"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-8080}"
# Keep PORT aligned with the chat door for Railway probes without leaking it
# into the IDE child.
export PORT="${OPENWORK_PORT}"

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

    # Sanitizing the remote alone would leave the checkout able to clone once
    # and never fetch again: git does not read WORKSPACE_REPO_URL, and this
    # image configures no credential helper. Supply the credential through a
    # helper that reads the environment at call time, so it is never written
    # to the volume while fetch, pull, and push keep working.
    #
    # The helper is per-repository rather than global, and the variable stays
    # in the daemon's environment where WORKSPACE_TOKEN already lives.
    if printf '%s' "${WORKSPACE_REPO_URL}" | grep -qE '://[^/@]+@'; then
      git -C "${WORKSPACE_DIR}" config credential.helper \
        '!f() { printf "%s\n" "url=${WORKSPACE_REPO_URL}"; }; f'
    fi
  else
    echo "workspace: initializing an empty repository at ${WORKSPACE_DIR}"
    git init --quiet "${WORKSPACE_DIR}"
  fi
fi

# The IDE door is reached only through the console's /IDE edge proxy on the
# private network (Railway does not publish :8080). Console authenticates the
# user via cp_active_workspace, then strips /IDE and forwards. --auth none here
# avoids a second login with WORKSPACE_TOKEN in the browser; chat still uses
# the shared token over bearer.
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

# --- IDE-006: co-located editor substrate ---------------------------------
# Remote commonplace-api cannot see these inodes. When the binary is in the
# image, run it against the same volume and point the pack at loopback.
EDITOR_SUBSTRATE_PORT="${EDITOR_SUBSTRATE_PORT:-50090}"
EDITOR_SUBSTRATE_STATE_DIR="${EDITOR_SUBSTRATE_STATE_DIR:-/workspace/state/editor-substrate}"
EDITOR_SUBSTRATE_ENV_FILE="${EDITOR_SUBSTRATE_ENV_FILE:-${EDITOR_SUBSTRATE_STATE_DIR}/editor.env}"
mkdir -p "${EDITOR_SUBSTRATE_STATE_DIR}/data"

if [ -x /usr/local/bin/commonplace-api ]; then
  export COMMONPLACE_API_KEY="${COMMONPLACE_API_KEY:-${WORKSPACE_TOKEN}}"
  export COMMONPLACE_DATA_DIR="${COMMONPLACE_DATA_DIR:-${EDITOR_SUBSTRATE_STATE_DIR}/data}"
  export COMMONPLACE_INSTANCE_ID="${COMMONPLACE_INSTANCE_ID:-workspace-editor}"
  export COMMONPLACE_SERVICE_ALLOWED_TENANTS="${COMMONPLACE_SERVICE_ALLOWED_TENANTS:-Travis-Gilbert}"
  # Local service-key registry only. Never pull console cookie secrets or the
  # shared control-plane pepper into this container.
  unset THEOREM_CONTROL_DATABASE_URL THEOREM_API_KEY_PEPPER || true

  echo "workspace: editor substrate on :${EDITOR_SUBSTRATE_PORT} over ${WORKSPACE_DIR}"
  # Bind [::]:PORT like the hosted API so private-network doctor probes reach it.
  # Do not leak this PORT into chat or code-server children.
  env PORT="${EDITOR_SUBSTRATE_PORT}" \
    COMMONPLACE_API_KEY="${COMMONPLACE_API_KEY}" \
    COMMONPLACE_DATA_DIR="${COMMONPLACE_DATA_DIR}" \
    COMMONPLACE_INSTANCE_ID="${COMMONPLACE_INSTANCE_ID}" \
    COMMONPLACE_SERVICE_ALLOWED_TENANTS="${COMMONPLACE_SERVICE_ALLOWED_TENANTS}" \
    setsid commonplace-api &
  pids+=($!)

  EDITOR_SUBSTRATE_URL="http://127.0.0.1:${EDITOR_SUBSTRATE_PORT}" \
  EDITOR_SUBSTRATE_STATE_DIR="${EDITOR_SUBSTRATE_STATE_DIR}" \
  EDITOR_SUBSTRATE_ENV_FILE="${EDITOR_SUBSTRATE_ENV_FILE}" \
  THEOREM_EDITOR_API_KEY="${COMMONPLACE_API_KEY}" \
  WORKSPACE_DIR="${WORKSPACE_DIR}" \
    node /usr/local/bin/bootstrap-editor-substrate.mjs \
    || echo "workspace: editor substrate bootstrap failed; starting doors without project_id" >&2

  if [ -f "${EDITOR_SUBSTRATE_ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a
    # shellcheck source=/dev/null
    . "${EDITOR_SUBSTRATE_ENV_FILE}"
    set +a
  fi
else
  echo "workspace: commonplace-api binary absent; pack will use THEOREM_EDITOR_* from Railway env if set" >&2
fi

CODE_SERVER_USER_DATA_DIR="${CODE_SERVER_USER_DATA_DIR:-/workspace/state/code-server/user-data}"
CODE_SERVER_EXTENSIONS_DIR="${CODE_SERVER_EXTENSIONS_DIR:-/workspace/state/code-server/extensions}"
mkdir -p "${CODE_SERVER_USER_DATA_DIR}/User" "${CODE_SERVER_EXTENSIONS_DIR}"

# Seed the immutable image pack into the volume-backed extensions dir so
# upgrades replace the pack without requiring users to reinstall manually.
PACK_SRC="/opt/commonplace/extensions/theorem-vscode"
PACK_DST="${CODE_SERVER_EXTENSIONS_DIR}/commonplace.theorem-vscode-0.1.0"
if [ -d "${PACK_SRC}" ]; then
  rm -rf "${PACK_DST}"
  mkdir -p "${PACK_DST}"
  cp -R "${PACK_SRC}/." "${PACK_DST}/"
  echo "workspace: seeded theorem-vscode into ${PACK_DST}"
fi

# Merge non-secret theorem.* settings from env. Secrets may also ride env
# (THEOREM_EDITOR_API_KEY) so the pack reads them without requiring settings.json.
SETTINGS_PATH="${CODE_SERVER_USER_DATA_DIR}/User/settings.json"
node - <<'NODE' "${SETTINGS_PATH}"
const fs = require('node:fs');
const path = process.argv[1];
let current = {};
try {
  current = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch {
  current = {};
}
const set = (key, value) => {
  if (typeof value === 'string' && value.trim().length > 0) current[key] = value.trim();
};
set('theorem.graphqlUrl', process.env.THEOREM_EDITOR_GRAPHQL_URL);
set('theorem.invalidationsUrl', process.env.THEOREM_EDITOR_INVALIDATIONS_URL);
set('theorem.projectId', process.env.THEOREM_EDITOR_PROJECT_ID);
set('theorem.consoleOrigin', process.env.THEOREM_CONSOLE_ORIGIN);
set('theorem.agentUrl', process.env.THEOREM_ACP_WS_URL);
// Prefer env for the key at runtime; only write settings when explicitly asked.
if (process.env.THEOREM_EDITOR_WRITE_TOKEN_TO_SETTINGS === '1') {
  set('theorem.token', process.env.THEOREM_EDITOR_API_KEY);
}
fs.writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
NODE

# PORT must not reach code-server: it overrides --bind-addr and steals the chat port.
env -u PORT \
  THEOREM_EDITOR_GRAPHQL_URL="${THEOREM_EDITOR_GRAPHQL_URL:-}" \
  THEOREM_EDITOR_INVALIDATIONS_URL="${THEOREM_EDITOR_INVALIDATIONS_URL:-}" \
  THEOREM_EDITOR_PROJECT_ID="${THEOREM_EDITOR_PROJECT_ID:-}" \
  THEOREM_EDITOR_API_KEY="${THEOREM_EDITOR_API_KEY:-}" \
  THEOREM_ACP_WS_URL="${THEOREM_ACP_WS_URL:-}" \
  THEOREM_ACP_TOKEN="${THEOREM_ACP_TOKEN:-}" \
  THEOREM_CONSOLE_ORIGIN="${THEOREM_CONSOLE_ORIGIN:-}" \
  setsid code-server \
  --bind-addr "0.0.0.0:${CODE_SERVER_PORT}" \
  --auth none \
  --disable-telemetry \
  --disable-update-check \
  --user-data-dir "${CODE_SERVER_USER_DATA_DIR}" \
  --extensions-dir "${CODE_SERVER_EXTENSIONS_DIR}" \
  --enable-proposed-api commonplace.theorem-vscode \
  "${WORKSPACE_DIR}" &
pids+=($!)

# Invoked as an explicit path, not through PATH.
#
# `openwork-server` on PATH depends on pnpm creating a bin shim in the root
# node_modules/.bin for a workspace project. That happens for a full workspace
# install, which is what a developer machine has, but the image runs a filtered
# install and I cannot confirm the shim exists there without building the
# image. A missing shim exits 127 and takes code-server down with it on every
# container start.
#
# dist/cli.js is what `pnpm build` emits and what the package's own `start`
# script runs, so this is the same entrypoint by a path that cannot fail to
# resolve.
#
# --workspace, not --dir: the daemon's flag is a repeatable workspace root
# (apps/chat-server/src/config.ts). The token rides the environment rather than
# --host-token so it never appears in the container's process list.
setsid bun /srv/openwork/apps/chat-server/dist/cli.js \
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

# A door exiting at all is a failure, including a clean one. Leaving status at
# 0 for an exit(0) meant the supervisor reported success and Railway's
# ON_FAILURE policy left the workspace offline with neither door running. The
# only correct exit status here is nonzero: this line is reached solely because
# something that should have run forever stopped.
if [ "${status}" -eq 0 ]; then
  echo "workspace: a door exited cleanly, which is still a stopped workspace" >&2
  status=70
fi
echo "workspace: a door exited with ${status}; stopping the other" >&2
shutdown
exit "${status}"
