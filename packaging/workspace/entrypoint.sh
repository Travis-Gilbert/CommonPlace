#!/usr/bin/env bash
# SOURCING: none. Pure process supervision, no upstream component applies.
#
# SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0 WT4: boot never clones a product repo.
# Checkouts live at /workspace/{workspace_id} after on-demand provision.
# Env carries how to reach services (ports, tokens for *doors*), never which
# tenant, repo, or user. WORKSPACE_REPO / WORKSPACE_REPO_URL are refused.
#
# IDE :8080 and chat :8787 still share this container near-term (WT9). The
# active folder is bound per session once the provision API exists; until then
# Studio opens an empty welcome root, not CommonPlace source.

set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
# Empty welcome tree for the IDE until a workspace object is provisioned.
# Not a git clone of product source. Dissolves CR-002 sticky-singleton clone.
WELCOME_DIR="${WELCOME_DIR:-${WORKSPACE_ROOT}/welcome}"
WORKSPACE_DIR="${WORKSPACE_DIR:-${WELCOME_DIR}}"
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

# SPEC law: env never names which repo. Operators must delete these vars.
if [ -n "${WORKSPACE_REPO:-}" ] || [ -n "${WORKSPACE_REPO_URL:-}" ]; then
  echo "workspace: WORKSPACE_REPO / WORKSPACE_REPO_URL are retired (SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0 WT4)." >&2
  echo "workspace: remove them from the service. Checkouts are provisioned per workspace object." >&2
  exit 78
fi

mkdir -p "${WORKSPACE_ROOT}" "${WELCOME_DIR}" "${WELCOME_DIR}/.vscode"
if [ ! -f "${WELCOME_DIR}/README.md" ]; then
  cat > "${WELCOME_DIR}/README.md" <<'EOF'
# CommonPlace workspace

No repository is open yet.

Connect GitHub in the console, pick a repository, and this IDE will open
`/workspace/{workspace_id}` for that checkout. Product source is never the
default folder.

Agent chat: Command Palette → **Theorem: Open Chat** (not the stock CHAT panel).
EOF
fi
# Workspace-scoped AI hide (reh-web may prefer workspace over sticky user
# settings that a "Use AI Features" click flipped in the browser).
cat > "${WELCOME_DIR}/.vscode/settings.json" <<'EOF'
{
  "chat.disableAIFeatures": true,
  "chat.commandCenter.enabled": false
}
EOF

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

echo "workspace: chat door on :${OPENWORK_PORT}, IDE door on :${CODE_SERVER_PORT}, welcome=${WELCOME_DIR} (no boot clone)"

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
  # Never default a product tenant in env (SPEC tenancy law). Empty allow-list
  # means the co-located API uses its own identity path; do not inject Travis-Gilbert.
  if [ -n "${COMMONPLACE_SERVICE_ALLOWED_TENANTS:-}" ]; then
    export COMMONPLACE_SERVICE_ALLOWED_TENANTS
  else
    unset COMMONPLACE_SERVICE_ALLOWED_TENANTS || true
  fi
  # Local service-key registry only. Never pull console cookie secrets or the
  # shared control-plane pepper into this container.
  unset THEOREM_CONTROL_DATABASE_URL THEOREM_API_KEY_PEPPER || true

  echo "workspace: editor substrate on :${EDITOR_SUBSTRATE_PORT} (bootstrap deferred until a workspace is provisioned)"
  # Bind [::]:PORT like the hosted API so private-network doctor probes reach it.
  # Do not leak this PORT into chat or code-server children.
  env PORT="${EDITOR_SUBSTRATE_PORT}" \
    COMMONPLACE_API_KEY="${COMMONPLACE_API_KEY}" \
    COMMONPLACE_DATA_DIR="${COMMONPLACE_DATA_DIR}" \
    COMMONPLACE_INSTANCE_ID="${COMMONPLACE_INSTANCE_ID}" \
    ${COMMONPLACE_SERVICE_ALLOWED_TENANTS:+COMMONPLACE_SERVICE_ALLOWED_TENANTS="${COMMONPLACE_SERVICE_ALLOWED_TENANTS}"} \
    setsid commonplace-api &
  pids+=($!)

  # WT4: do not createProject against a product checkout at boot. Provision
  # API will bootstrap per /workspace/{workspace_id} later.
  if [ -n "${WORKSPACE_PROVISION_BOOTSTRAP:-}" ]; then
    EDITOR_SUBSTRATE_URL="http://127.0.0.1:${EDITOR_SUBSTRATE_PORT}" \
    EDITOR_SUBSTRATE_STATE_DIR="${EDITOR_SUBSTRATE_STATE_DIR}" \
    EDITOR_SUBSTRATE_ENV_FILE="${EDITOR_SUBSTRATE_ENV_FILE}" \
    THEOREM_EDITOR_API_KEY="${COMMONPLACE_API_KEY}" \
    WORKSPACE_DIR="${WORKSPACE_DIR}" \
      node /usr/local/bin/bootstrap-editor-substrate.mjs \
      || echo "workspace: editor substrate bootstrap failed; starting doors without project_id" >&2
  else
    echo "workspace: skipping editor createProject at boot (SPEC WT4)"
  fi

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
#
# IMPORTANT: `node - <<'NODE' "$path"` puts the path in argv[2], not argv[1]
# (argv[1] is the literal "-"). An earlier revision wrote User settings to
# `$PWD/-` (live: /srv/openwork/-), so chat.disableAIFeatures never reached
# the Studio profile and the stock Copilot-shaped CHAT panel stayed visible.
SETTINGS_PATH="${CODE_SERVER_USER_DATA_DIR}/User/settings.json"
SETTINGS_PATH="${SETTINGS_PATH}" node <<'NODE'
const fs = require('node:fs');
const path = process.env.SETTINGS_PATH;
if (!path) throw new Error('SETTINGS_PATH unset');
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
// Hide upstream Copilot/chat chrome. Theorem ACP lives in the pack
// (Theorem: Open Chat), not the stock CHAT Agent panel. Always force true:
// users clicking "Use AI Features" must not re-open Copilot entitlement UI on
// the next boot of this shared profile (SPEC D1 + Studio Copilot retirement).
current['chat.disableAIFeatures'] = true;
current['chat.commandCenter.enabled'] = false;
fs.mkdirSync(require('node:path').dirname(path), { recursive: true });
fs.writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
console.log(`workspace: wrote ${path}`);
NODE

# --- CS-004: which binary hosts the IDE door -------------------------------
# Commonplace Studio's reh-web server when the image carries it, stock
# code-server otherwise. Same port, same user-data and extensions dirs, so the
# volume's state survives the swap in either direction and rollback is a build
# arg rather than a migration.
#
# The dirs keep their CODE_SERVER_* names on purpose: they are already set in
# Railway and already populated on the live volume, and renaming them would
# silently hand every existing workspace an empty profile.
STUDIO_SERVER_BIN="${STUDIO_SERVER_BIN:-/opt/commonplace/studio-server/bin/commonplace-studio-server}"
if [ -z "${IDE_HOST:-}" ]; then
  if [ -x "${STUDIO_SERVER_BIN}" ]; then IDE_HOST=studio; else IDE_HOST=code-server; fi
fi

# CS-006: the pack reads these at runtime rather than from settings.json, so
# both hosts get the identical substrate environment. Losing one of these is
# how the IDE opens with honest-but-dead providers.
ide_env=(
  THEOREM_EDITOR_GRAPHQL_URL="${THEOREM_EDITOR_GRAPHQL_URL:-}"
  THEOREM_EDITOR_INVALIDATIONS_URL="${THEOREM_EDITOR_INVALIDATIONS_URL:-}"
  THEOREM_EDITOR_PROJECT_ID="${THEOREM_EDITOR_PROJECT_ID:-}"
  THEOREM_EDITOR_API_KEY="${THEOREM_EDITOR_API_KEY:-}"
  THEOREM_ACP_WS_URL="${THEOREM_ACP_WS_URL:-}"
  THEOREM_ACP_TOKEN="${THEOREM_ACP_TOKEN:-}"
  THEOREM_CONSOLE_ORIGIN="${THEOREM_CONSOLE_ORIGIN:-}"
)

case "${IDE_HOST}" in
  studio)
    if [ ! -x "${STUDIO_SERVER_BIN}" ]; then
      echo "workspace: IDE_HOST=studio but ${STUDIO_SERVER_BIN} is missing or not executable." >&2
      echo "workspace: build the image with IDE_HOST=studio, or set IDE_HOST=code-server." >&2
      exit 65
    fi
    echo "workspace: IDE host is Commonplace Studio (${STUDIO_SERVER_BIN})"
    # Flag translation from the code-server invocation below:
    #   --bind-addr host:port      -> --host + --port
    #   --auth none                -> --without-connection-token
    #   --disable-update-check     -> dropped; the fork ships no update server
    #   positional folder          -> --default-folder
    # --accept-server-license-terms is required or the server prompts on a tty
    # that no container has and never binds. --disable-workspace-trust keeps
    # parity with code-server, which does not gate the checkout behind a modal.
    # No --server-base-path: the console edge strips /IDE before forwarding, so
    # the server correctly believes it is at the root.
    #
    # PORT must not reach it. Upstream's server reads PORT and would take the
    # chat door's port, the same collision code-server caused (GL7 2026-08-03).
    env -u PORT "${ide_env[@]}" \
      setsid "${STUDIO_SERVER_BIN}" \
      --host 0.0.0.0 \
      --port "${CODE_SERVER_PORT}" \
      --without-connection-token \
      --accept-server-license-terms \
      --disable-telemetry \
      --disable-workspace-trust \
      --server-data-dir "${CODE_SERVER_USER_DATA_DIR}/server" \
      --user-data-dir "${CODE_SERVER_USER_DATA_DIR}" \
      --extensions-dir "${CODE_SERVER_EXTENSIONS_DIR}" \
      --enable-proposed-api commonplace.theorem-vscode \
      --default-folder "${WORKSPACE_DIR}" &
    pids+=($!)
    ;;
  code-server)
    echo "workspace: IDE host is stock code-server (Studio server not in this image)"
    # PORT must not reach code-server: it overrides --bind-addr and steals the chat port.
    env -u PORT "${ide_env[@]}" \
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
    ;;
  *)
    echo "workspace: IDE_HOST=${IDE_HOST} is not a host. Use studio or code-server." >&2
    exit 64
    ;;
esac

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
