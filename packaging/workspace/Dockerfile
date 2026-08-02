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
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /srv/openwork

# Workspace manifests first so a source-only change does not reinstall.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/chat-server/package.json apps/chat-server/
COPY packages/openwork-types/package.json packages/openwork-types/
COPY packages/openwork-paths/package.json packages/openwork-paths/

RUN corepack enable \
  && corepack prepare pnpm@10.30.1 --activate \
  && pnpm install --filter @commonplace/chat-server... --frozen-lockfile --prod=false

COPY apps/chat-server apps/chat-server
COPY packages/openwork-types packages/openwork-types
COPY packages/openwork-paths packages/openwork-paths

RUN pnpm --filter @commonplace/chat-server build

# The built chat register, served by the daemon's static handler. Built on the
# host or in a prior stage: this image does not carry the web app's toolchain.
COPY apps/chat/dist /srv/openwork/public

COPY packaging/workspace/entrypoint.sh /usr/local/bin/workspace-entrypoint
RUN chmod +x /usr/local/bin/workspace-entrypoint

# The single checkout both doors open. Mount a volume here: everything else in
# the image is replaceable, and this is the only thing that is not.
ENV WORKSPACE_DIR=/workspace/repo
ENV OPENWORK_PORT=8787
ENV CODE_SERVER_PORT=8080
RUN mkdir -p "${WORKSPACE_DIR}"
VOLUME ["/workspace"]

EXPOSE 8787 8080

# The chat door is the healthcheck: it is the one the console proxies to, so
# an image that answers here is an image the console can actually use.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${OPENWORK_PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
