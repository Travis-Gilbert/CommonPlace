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

async function shutdown(signal) {
  server.close(async () => {
    await disconnectIdentityService();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
  console.info(`Received ${signal}; closing CommonPlace fork server`);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
