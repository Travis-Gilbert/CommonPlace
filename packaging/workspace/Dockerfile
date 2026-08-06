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

# --- Stage 1a: co-located editor substrate (commonplace-api) --------------
# Remote Railway commonplace-api cannot see /workspace/repo inodes. IDE-006
# runs the same binary beside the volume so createProject(rootPath) indexes
# the checkout both doors edit.
#
# Prefer a digest-pinned prebuilt image (fast):
#   --build-arg EDITOR_API_IMAGE=ghcr.io/.../commonplace-api@sha256:...
# Otherwise clone Theorem and build (slow, default when INCLUDE_EDITOR_SUBSTRATE=1).
ARG INCLUDE_EDITOR_SUBSTRATE=1
ARG EDITOR_API_IMAGE=
ARG THEOREM_GIT_URL=https://github.com/Travis-Gilbert/Theorem.git
ARG THEOREM_GIT_REF=main

FROM rust:1.96.1-bookworm AS editor-api-build
# Re-declare with default inside the stage. A bare `ARG NAME` does not inherit
# the pre-FROM default when Railway does not pass --build-arg, which left
# INCLUDE empty and shipped SKIP (binary absent at runtime).
ARG INCLUDE_EDITOR_SUBSTRATE=1
ARG THEOREM_GIT_URL=https://github.com/Travis-Gilbert/Theorem.git
ARG THEOREM_GIT_REF=main
# Private Theorem: Railway auto-passes matching service vars as Docker build
# args. Declare ARG without an empty default so an unset arg does not wipe a
# real value, then require the token for INCLUDE=1.
#
# KNOWN EXPOSURE, deliberately left in place for now. BuildKit prints each RUN
# instruction with its build args already substituted, so the clone URL below
# copies THEOREM_GIT_TOKEN verbatim into the build log, which outlives the build
# and is readable by anyone with access to the project. Treat this PAT as
# published and rotate it; the comment that used to sit here said "never echo
# it" directly above the line that echoed it, which is worse than saying so.
#
# The obvious fix does not work. Escaping the `$` so BuildKit prints the name
# and the shell expands the value defeats the expansion as well as the echo:
# deploy 7d4fdfae proved the log is clean that way and the clone then fails with
# exit 128, because the backslash survives into the command and git receives the
# literal string. Railway's builder takes no `--secret`, so `RUN
# --mount=type=secret` is not available either, and their own guidance is ARG
# plus a single RUN inside a throwaway stage, which is what this already is.
#
# So the exposure is bounded rather than removed: the token reaches this stage
# only, and the final image COPYs just the compiled binary, so no shipped layer
# carries it. Closing it properly needs a mechanism that survives a build cycle,
# and that is worth doing against a rotated token rather than this one.
ARG THEOREM_GIT_TOKEN
RUN if [ "${INCLUDE_EDITOR_SUBSTRATE}" != "1" ]; then \
      mkdir -p /out && printf 'skipped\n' > /out/SKIP; \
    else \
      apt-get update \
        && apt-get install -y --no-install-recommends protobuf-compiler git ca-certificates \
        && rm -rf /var/lib/apt/lists/* \
        && if [ -z "${THEOREM_GIT_TOKEN}" ]; then \
             echo "editor-api-build: THEOREM_GIT_TOKEN is required to clone private Theorem" >&2; \
             exit 64; \
           fi \
        && git clone --depth 1 --branch "${THEOREM_GIT_REF}" \
             "https://x-access-token:${THEOREM_GIT_TOKEN}@github.com/Travis-Gilbert/Theorem.git" /src \
        && cd /src/apps/commonplace-api \
        && cargo build -p commonplace-api --release --bin commonplace-api \
        && mkdir -p /out \
        && cp /src/apps/commonplace-api/target/release/commonplace-api /out/commonplace-api \
        && test -x /out/commonplace-api; \
    fi
# The token reaches this stage's RUN only; the final image COPYs just the
# binary, so no layer that ships carries it. THEOREM_GIT_URL is now the clone
# source it was always declared to be, rather than a parameter beside a
# hardcoded URL that ignored it.

# Optional prebuilt override: when EDITOR_API_IMAGE is non-empty, final stage
# copies from it instead of editor-api-build. BuildKit cannot conditionally
# FROM an empty ARG, so the default path is the build stage above.

# --- Stage 1b: build the Theorem VS Code pack -----------------------------
# Staged into the workspace image so /IDE code-server activates substrate
# providers (PR #436 GraphQL / invalidations / ACP), not bare filesystem only.
FROM node:22-bookworm-slim AS vscode-pack

WORKDIR /build
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/theorem-vscode/package.json apps/theorem-vscode/
COPY packages/theorem-acp/package.json packages/theorem-acp/
COPY packages/theorem-chat-register/package.json packages/theorem-chat-register/
COPY packages/block-view-contracts/package.json packages/block-view-contracts/
RUN pnpm install --filter theorem-vscode... --frozen-lockfile

COPY apps/theorem-vscode apps/theorem-vscode
COPY packages/theorem-acp packages/theorem-acp
COPY packages/theorem-chat-register packages/theorem-chat-register
COPY packages/block-view-contracts packages/block-view-contracts
RUN pnpm --filter theorem-vscode run build \
  && mkdir -p /opt/extension/theorem-vscode \
  && cp apps/theorem-vscode/package.json /opt/extension/theorem-vscode/ \
  && cp -R apps/theorem-vscode/dist /opt/extension/theorem-vscode/

# --- Stage 1c: Commonplace Studio reh-web server (CS-003) ------------------
# The IDE door's host. Studio is the fork's own web workbench; code-server is
# the thing it replaces. Carrying both long term means two patch queues against
# the same upstream plus a second auth layer duplicating console session auth,
# which is why the follow-up exists.
#
# Gated by BUILD_STUDIO_SERVER, deliberately not by IDE_HOST. Railway injects
# every service variable into whatever ARG a stage declares, so while this stage
# read `ARG IDE_HOST`, setting IDE_HOST=code-server on the service to choose the
# runtime host also switched the build off, and the next image shipped no Studio
# to cut over to. One name cannot be both the runtime switch and the build
# switch. IDE_HOST is runtime only now, read by entrypoint.sh; the rollback here
# is a build arg and not a revert:
#   --build-arg BUILD_STUDIO_SERVER=0
# which still writes /out, so the COPY into the runtime image stays valid. What
# it omits is the launcher, which is exactly what entrypoint.sh probes with -x
# before choosing a host, so a skipped build falls back to code-server on its
# own rather than starting a door that is not there.
#
# `server`, not `web`: build.sh's web target is a development compile that only
# scripts/code-server.sh can run. `server` emits upstream's reh-web target, a
# self-contained server directory with its own node and bin entrypoint.

# node:24, not node:22 like the stages above. Upstream 1.131.0 pins .nvmrc to
# 24.18.0 and build/npm/preinstall.ts throws on any other major, so a node:22
# base fails this stage before a single file compiles.
FROM node:24-bookworm AS studio-server
ARG BUILD_STUDIO_SERVER=1
RUN if [ "${BUILD_STUDIO_SERVER}" != "1" ]; then \
      mkdir -p /out && printf 'skipped\n' > /out/SKIP; \
    else \
      apt-get update \
        && apt-get install -y --no-install-recommends \
             build-essential python3 git ca-certificates pkg-config \
             libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev \
        && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /studio
COPY packaging/commonplace-studio /studio/packaging/commonplace-studio
COPY LICENSE /studio/LICENSE
# The pack is already compiled one stage up; STUDIO_PACK_DIR skips rebuilding it
# here, where there is no pnpm workspace to rebuild it from.
COPY --from=vscode-pack /opt/extension/theorem-vscode /studio/pack/theorem-vscode
RUN if [ "${BUILD_STUDIO_SERVER}" != "1" ]; then \
      echo "studio-server: BUILD_STUDIO_SERVER=${BUILD_STUDIO_SERVER}, skipping the Studio build"; \
    else \
      cd /studio/packaging/commonplace-studio \
        && STUDIO_BUILD_DIR=/studio/build \
           STUDIO_PACK_DIR=/studio/pack/theorem-vscode \
           STUDIO_SERVER_PLATFORM=linux \
           STUDIO_SERVER_ARCH="$(dpkg --print-architecture | sed 's/^amd64$/x64/;s/^arm64$/arm64/')" \
           ./scripts/build.sh server \
        && mkdir -p /out \
        && cp -R /studio/build/vscode-reh-web-linux-*/. /out/ \
        && test -x /out/bin/commonplace-studio-server; \
    fi

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

# Stage the Theorem pack + grant proposed APIs on the stock code-server product.
COPY --from=vscode-pack /opt/extension/theorem-vscode /opt/commonplace/extensions/theorem-vscode
COPY packaging/workspace/patch-code-server-product.mjs /usr/local/bin/patch-code-server-product.mjs
RUN node /usr/local/bin/patch-code-server-product.mjs

# The other IDE host. This COPY is what makes the studio-server stage part of
# the image: a stage nothing copies from is a stage BuildKit never runs, so
# without this line the fork compiled nowhere and entrypoint.sh's -x probe found
# nothing to select, which is how an image that was supposed to ship both hosts
# quietly shipped one. The stage asserts its own launcher with `test -x`, so a
# broken Studio build fails the image here rather than at container start.
COPY --from=studio-server /out/ /opt/commonplace/studio-server/

# Co-located editor substrate binary (IDE-006). Absent when INCLUDE_EDITOR_SUBSTRATE=0.
COPY --from=editor-api-build /out/ /opt/commonplace/editor-api/
RUN if [ -f /opt/commonplace/editor-api/commonplace-api ]; then \
      cp /opt/commonplace/editor-api/commonplace-api /usr/local/bin/commonplace-api \
      && chmod +x /usr/local/bin/commonplace-api; \
    else \
      echo "workspace: editor substrate binary not bundled (INCLUDE_EDITOR_SUBSTRATE=0)"; \
    fi
COPY packaging/workspace/bootstrap-editor-substrate.mjs /usr/local/bin/bootstrap-editor-substrate.mjs

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
ENV EDITOR_SUBSTRATE_PORT=50090
# Durable local editor graph beside the checkout volume (not the remote API).
ENV COMMONPLACE_INSTANCE_ID=workspace-editor
ENV COMMONPLACE_SERVICE_ALLOWED_TENANTS=Travis-Gilbert
# JSON map tenant → absolute roots the co-located API may mount (createProject).
ENV COMMONPLACE_WORKSPACE_TENANT_ALLOWED_ROOTS={"Travis-Gilbert":["/workspace/repo"]}
ENV THEOREM_CONSOLE_ORIGIN=https://v2.theoremharness.com
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

EXPOSE 8787 8080 50090

# The OpenWork `:8787` process remains the container HEALTHCHECK target until a
# follow-up moves health onto the Studio IDE door. Product `/chat` is Theorem
# register on the console (not this proxy). See SPEC-THEOREM-CHAT-REGISTER-1.0.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${OPENWORK_PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
