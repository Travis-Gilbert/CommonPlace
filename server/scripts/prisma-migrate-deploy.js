"use strict";

// SOURCING: none. Controlled FK3 identity migration entrypoint.

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const {
  assertIdentityDatabaseBoundary,
} = require("../utils/identity/prisma-access");

const SERVER_ROOT = resolve(__dirname, "..");
const IDENTITY_SCHEMA_PATH = resolve(SERVER_ROOT, "prisma", "schema.prisma");
const PRISMA_CLI_PATH = require.resolve("prisma/build/index.js");

function runIdentityMigrationDeploy({
  environment = process.env,
  spawnSyncImpl = spawnSync,
} = {}) {
  assertIdentityDatabaseBoundary(environment, { forMigration: true });

  const result = spawnSyncImpl(
    process.execPath,
    [
      PRISMA_CLI_PATH,
      "migrate",
      "deploy",
      "--schema",
      IDENTITY_SCHEMA_PATH,
    ],
    {
      cwd: SERVER_ROOT,
      env: environment,
      stdio: "inherit",
    }
  );

  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`Prisma migrate deploy stopped by ${result.signal}`);
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

if (require.main === module) {
  try {
    process.exitCode = runIdentityMigrationDeploy();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Prisma migrate deploy could not start"
    );
    process.exitCode = 1;
  }
}

module.exports = {
  IDENTITY_SCHEMA_PATH,
  PRISMA_CLI_PATH,
  runIdentityMigrationDeploy,
};
