"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const {
  IDENTITY_SCHEMA_PATH,
  PRISMA_CLI_PATH,
  runIdentityMigrationDeploy,
} = require("../../../scripts/prisma-migrate-deploy");

const RUNTIME_URL =
  "postgresql://identity:example@pgbouncer.internal:6432/commonplace";
const DIRECT_URL =
  "postgresql://migrator:example@postgres.internal:5432/commonplace";

test("migration deploy refuses an absent or pooled direct database before Prisma", () => {
  let spawns = 0;
  const spawnSyncImpl = () => {
    spawns += 1;
    return { status: 0 };
  };

  assert.throws(
    () =>
      runIdentityMigrationDeploy({
        environment: { IDENTITY_DATABASE_URL: RUNTIME_URL },
        spawnSyncImpl,
      }),
    /IDENTITY_DIRECT_DATABASE_URL is required/
  );
  assert.throws(
    () =>
      runIdentityMigrationDeploy({
        environment: {
          IDENTITY_DATABASE_URL: RUNTIME_URL,
          IDENTITY_DIRECT_DATABASE_URL: RUNTIME_URL,
        },
        spawnSyncImpl,
      }),
    /must bypass the runtime PgBouncer endpoint/
  );
  assert.equal(spawns, 0);
});

test("migration deploy invokes the pinned Prisma CLI with the direct-url schema", () => {
  const environment = {
    IDENTITY_DATABASE_URL: RUNTIME_URL,
    IDENTITY_DIRECT_DATABASE_URL: DIRECT_URL,
  };
  let invocation;
  const status = runIdentityMigrationDeploy({
    environment,
    spawnSyncImpl(executable, args, options) {
      invocation = { executable, args, options };
      return { status: 0 };
    },
  });

  assert.equal(status, 0);
  assert.equal(invocation.executable, process.execPath);
  assert.deepEqual(invocation.args, [
    PRISMA_CLI_PATH,
    "migrate",
    "deploy",
    "--schema",
    IDENTITY_SCHEMA_PATH,
  ]);
  assert.equal(invocation.options.env, environment);
  assert.equal(invocation.options.env.IDENTITY_DATABASE_URL, RUNTIME_URL);
  assert.equal(
    invocation.options.env.IDENTITY_DIRECT_DATABASE_URL,
    DIRECT_URL
  );
  assert.match(
    readFileSync(IDENTITY_SCHEMA_PATH, "utf8"),
    /directUrl\s*=\s*env\("IDENTITY_DIRECT_DATABASE_URL"\)/
  );
});
