"use strict";

const { createApp } = require("./app");
const {
  disconnectIdentityService,
  getIdentityService,
} = require("./utils/identity");
const { CollectorApi } = require("./utils/collectorApi");
const {
  createCollectorIngestBoundary,
} = require("./utils/collectorApi/ingest-boundary");
const {
  createIngestPipelineClient,
} = require("./utils/collectorApi/ingest-pipeline");
const { createIdentityOperations } = require("./utils/identity/operations");

const SHUTDOWN_GRACE_MS = 10_000;

function parsePort(value) {
  const port = Number(value ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 through 65535");
  }
  return port;
}

function parseAdminLogins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((login) => login.trim())
    .filter(Boolean);
}

function createShutdownHandler({
  server,
  disconnect = disconnectIdentityService,
  exit = process.exit,
  logger = console,
  graceMs = SHUTDOWN_GRACE_MS,
  scheduleTimeout = setTimeout,
  cancelTimeout = clearTimeout,
} = {}) {
  if (!server || typeof server.close !== "function") {
    throw new TypeError("An HTTP server is required");
  }

  let shutdownPromise = null;
  return function shutdown(signal) {
    if (shutdownPromise) return shutdownPromise;

    logger.info?.(`Received ${signal}; closing CommonPlace fork server`);
    shutdownPromise = new Promise((resolve) => {
      let completed = false;
      let forceTimer;

      function finish(exitCode) {
        if (completed) return;
        completed = true;
        cancelTimeout(forceTimer);
        exit(exitCode);
        resolve(exitCode);
      }

      forceTimer = scheduleTimeout(() => {
        if (completed) return;
        try {
          server.closeAllConnections?.();
        } finally {
          finish(1);
        }
      }, graceMs);

      server.close((error) => {
        if (error) {
          logger.error?.({
            name: error.name ?? "Error",
            message: error.message ?? "HTTP server close failed",
          });
          finish(1);
          return;
        }
        void (async () => {
          try {
            await disconnect();
            finish(0);
          } catch (disconnectError) {
            logger.error?.({
              name: disconnectError?.name ?? "Error",
              message:
                disconnectError?.message ?? "Identity service disconnect failed",
            });
            finish(1);
          }
        })();
      });
      server.closeIdleConnections?.();
    });

    return shutdownPromise;
  };
}

function startServer() {
  const identity = getIdentityService();
  const operations = createIdentityOperations(identity, {
    tokenPepper: process.env.IDENTITY_TOKEN_PEPPER,
  });
  const documentIngest = createCollectorIngestBoundary({
    // Both peers initialize lazily. Login and workspace administration remain
    // available when either the collector or graph tier is down.
    collectorApi: {
      async parseBytes(input) {
        return new CollectorApi().parseBytes(input);
      },
    },
    async resolveScope({ request, workspaceId }) {
      return operations.resolveWorkspaceContentScope(
        request.contentPrincipal,
        workspaceId
      );
    },
    ingestPipeline: createIngestPipelineClient(),
  });
  const app = createApp({
    operations,
    documentIngest: {
      async ingestUpload(input) {
        input.request.contentPrincipal = input.principal;
        return documentIngest.ingestUpload(input);
      },
    },
    internalKey: process.env.COMMONPLACE_FORK_SERVER_INTERNAL_KEY,
    adminLogins: parseAdminLogins(process.env.COMMONPLACE_ADMIN_LOGINS),
  });
  const server = app.listen(parsePort(process.env.PORT), "0.0.0.0");
  const shutdown = createShutdownHandler({ server });

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  return { app, server, shutdown };
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createShutdownHandler,
  parseAdminLogins,
  parsePort,
  startServer,
};
