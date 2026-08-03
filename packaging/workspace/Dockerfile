# One workspace container, two doors.
# SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5, named choice 6.
#
# The chat register and the IDE register see the same filesystem because they
# are the same filesystem: one checkout at ${WORKSPACE_DIR}, two processes over
# it. There is no sync step because there is nothing to sync. Any design where
# the two doors hold separate copies needs a reconciler, and a reconciler is a
# thing that can be wrong; this cannot.
#
# Build context is the repository root:
#   docker build -f packaging/workspace/Dockerfile -t commonplace-workspace .

# --- Stage 1: build the chat register -------------------------------------
# apps/chat/dist is gitignored, so it is never in the build context. Copying it
# was a straight defect: the image could not build at all.
# Node (not Bun) owns this stage: the Vite chat register is a pnpm workspace
# package and oven/bun images ship without corepack/node.
FROM node:22-bookworm-slim AS web

WORKDIR /build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/chat/package.json apps/chat/
COPY packages/openwork-ui/package.json packages/openwork-ui/
COPY packages/openwork-types/package.json packages/openwork-types/
COPY packages/openwork-paths/package.json packages/openwork-paths/
RUN pnpm install --filter @commonplace/chat... --frozen-lockfile

COPY apps/chat apps/chat
COPY packages/openwork-ui packages/openwork-ui
COPY packages/openwork-types packages/openwork-types
COPY packages/openwork-paths packages/openwork-paths
# The token generator reads the console's registers, so they must be present.
COPY apps/console/src/styles apps/console/src/styles
RUN pnpm --filter @commonplace/chat build:web

# --- Stage 2: the workspace image -----------------------------------------
FROM oven/bun:1.3.10-debian AS base

# git: the workspace is a checkout, and both doors expect real VCS state.
# ca-certificates: the head reaches the Theorem MCP over TLS.
# curl: the healthcheck, and the code-server install script.
# procps: the entrypoint supervises two children and needs to reap them.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    procps \
    openssh-client \
  && rm -rf /var/lib/apt/lists/*

# pnpm workspace install for chat-server needs Node/corepack. Bun alone does
# not provide them on this base image (GL7 cutover build failure 2026-08-03).
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
  && ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && corepack enable \
  && corepack prepare pnpm@10.30.1 --activate

# --- The IDE door ---------------------------------------------------------
# code-server is installed from its own release channel rather than rebuilt.
# Pinned: an unpinned install script is a different image every build, which
# defeats the point of shipping an image at all.
ARG CODE_SERVER_VERSION=4.108.1
RUN curl -fsSL https://code-server.dev/install.sh \
  | sh -s -- --version "${CODE_SERVER_VERSION}" --method standalone --prefix /usr/local

# --- The chat door --------------------------------------------------------
# opencode is the engine the head runs on (OW6: stay on the opencode head).
# The version is the one apps/chat-server/constants.json names, so the image
# and the daemon agree about which engine they are talking to.
ARG OPENCODE_VERSION=1.17.11
RUN bun add -g "opencode-ai@${OPENCODE_VERSION}"
ENV PATH="/root/.bun/bin:/srv/openwork/node_modules/.bin:${PATH}"

WORKDIR /srv/openwork

# Workspace manifests first so a source-only change does not reinstall.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/chat-server/package.json apps/chat-server/
COPY packages/openwork-types/package.json packages/openwork-types/
COPY packages/openwork-paths/package.json packages/openwork-paths/

RUN pnpm install --filter @commonplace/chat-server... --frozen-lockfile --prod=false

COPY apps/chat-server apps/chat-server
COPY packages/openwork-types packages/openwork-types
COPY packages/openwork-paths packages/openwork-paths

RUN pnpm --filter @commonplace/chat-server build

# The built chat register, from the stage above.
COPY --from=web /build/apps/chat/dist /srv/openwork/public

COPY packaging/workspace/entrypoint.sh /usr/local/bin/workspace-entrypoint
RUN chmod +x /usr/local/bin/workspace-entrypoint

# The single checkout both doors open. Mount a volume here: everything else in
# the image is replaceable, and this is the only thing that is not.
ENV WORKSPACE_DIR=/workspace/repo
ENV OPENWORK_PORT=8787
ENV CODE_SERVER_PORT=8080
# Without this the daemon starts with no engine and sessions cannot run
# (apps/chat-server/src/cli.ts gates the managed engine on exactly "1").
ENV OPENWORK_MANAGE_OPENCODE=1
# serveStaticUi is a no-op unless this names the web root, so the copied
# bundle above would never be served.
ENV OPENWORK_WEB_ROOT=/srv/openwork/public
# The static handler otherwise embeds config.token in the HTML it serves, so
# an unauthenticated GET / hands out a usable bearer token.
ENV OPENWORK_WEB_BOOTSTRAP_TOKEN=0
# opencode keeps its session database here and the daemon keeps runtime.sqlite,
# tokens, and config here. Both default under /root, which is container layer:
# a redeploy would keep the checkout and discard every transcript.
ENV XDG_DATA_HOME=/workspace/state/data
ENV XDG_CONFIG_HOME=/workspace/state/config
# The audit trail does not use XDG at all: openworkServerDataDir() defaults to
# $HOME/.openwork and reads OPENWORK_DATA_DIR, so without this the log behind
# /workspace/:id/audit was still discarded on every redeploy.
ENV OPENWORK_DATA_DIR=/workspace/state/openwork
RUN mkdir -p "${WORKSPACE_DIR}" "${XDG_DATA_HOME}" "${XDG_CONFIG_HOME}" "${OPENWORK_DATA_DIR}"
# Railway rejects Dockerfile VOLUME. Persist /workspace with a Railway Volume
# mount on the commonplace-workspace service instead (OW5 / cutover GL7).

EXPOSE 8787 8080

# The chat door is the healthcheck: it is the one the console proxies to, so
# an image that answers here is an image the console can actually use.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${OPENWORK_PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
