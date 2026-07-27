"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  IDENTITY_DELEGATES,
  IdentityAccessViolation,
  assertIdentityDatabaseBoundary,
  createIdentityPrismaAccess,
} = require("../../../utils/identity/prisma-access");
const {
  createIdentityService,
  disconnectIdentityService,
  getIdentityService,
} = require("../../../utils/identity");

function makePrismaClient(marker = "root") {
  const client = Object.fromEntries(
    IDENTITY_DELEGATES.map((name) => [
      name,
      {
        marker: `${marker}:${name}`,
        findUnique(query) {
          return { marker: this.marker, query };
        },
      },
    ])
  );

  client.$connect = async () => `${marker}:connected`;
  client.$disconnect = async () => `${marker}:disconnected`;
  client.$queryRaw = async () => "raw access must remain unreachable";
  client.workspaceChat = { marker: `${marker}:workspaceChat` };
  client.$transaction = async (callback, options) =>
    callback(Object.assign(makePrismaClient("transaction"), { options }));

  return client;
}

test("exports the exact identity delegate allowlist", () => {
  assert.deepEqual(IDENTITY_DELEGATES, [
    "user",
    "session",
    "apiKey",
    "workspace",
    "workspaceMembership",
    "role",
    "invite",
    "billingAccount",
  ]);
});

test("exposes identity delegates and lifecycle without the raw Prisma client", async () => {
  const access = createIdentityPrismaAccess(makePrismaClient());

  assert.deepEqual(access.user.findUnique({ where: { id: "user-1" } }), {
    marker: "root:user",
    query: { where: { id: "user-1" } },
  });
  assert.equal(await access.connect(), "root:connected");
  assert.equal(await access.disconnect(), "root:disconnected");
  assert.equal(Object.prototype.toString.call(access), "[object IdentityPrismaAccess]");
  assert.equal(access.then, undefined);

  assert.throws(() => access.workspaceChat, IdentityAccessViolation);
  assert.throws(() => access.document, IdentityAccessViolation);
  assert.throws(() => access.$queryRaw, IdentityAccessViolation);
  assert.throws(() => {
    access.user = {};
  }, IdentityAccessViolation);
});

test("interactive transactions receive the same bounded identity surface", async () => {
  const access = createIdentityPrismaAccess(makePrismaClient());

  const result = await access.withTransaction(async (transaction) => {
    assert.equal(transaction.session.marker, "transaction:session");
    assert.equal(transaction.then, undefined);
    assert.throws(() => transaction.connect, IdentityAccessViolation);
    assert.throws(() => transaction.workspaceChat, IdentityAccessViolation);
    assert.throws(() => transaction.$queryRaw, IdentityAccessViolation);
    return transaction.workspace.marker;
  });

  assert.equal(result, "transaction:workspace");
  await assert.rejects(
    () => access.withTransaction(null),
    /withTransaction requires a callback/
  );
});

test("fails closed when an allowed delegate or Prisma lifecycle method is absent", () => {
  const missingDelegate = makePrismaClient();
  delete missingDelegate.role;
  assert.throws(
    () => createIdentityPrismaAccess(missingDelegate),
    /identity delegate "role" is unavailable/
  );

  const missingTransaction = makePrismaClient();
  delete missingTransaction.$transaction;
  assert.throws(
    () => createIdentityPrismaAccess(missingTransaction),
    /method "\$transaction" is unavailable/
  );
});

test("database preflight accepts only independent PostgreSQL identity URLs", () => {
  const runtimeUrl =
    "postgresql://identity_user:example@pgbouncer.internal:6432/commonplace";
  const directUrl =
    "postgresql://identity_migrator:example@postgres.internal:5432/commonplace";

  assert.equal(
    assertIdentityDatabaseBoundary({
      IDENTITY_DATABASE_URL: runtimeUrl,
    }),
    true
  );
  assert.equal(
    assertIdentityDatabaseBoundary(
      {
        IDENTITY_DATABASE_URL: runtimeUrl,
        IDENTITY_DIRECT_DATABASE_URL: directUrl,
      },
      { forMigration: true }
    ),
    true
  );

  assert.throws(
    () => assertIdentityDatabaseBoundary({}),
    /IDENTITY_DATABASE_URL is required/
  );
  assert.throws(
    () =>
      assertIdentityDatabaseBoundary({
        IDENTITY_DATABASE_URL: "http://rustyred.internal:8380",
      }),
    /must use postgres/
  );
  assert.throws(
    () =>
      assertIdentityDatabaseBoundary({
        IDENTITY_DATABASE_URL:
          "postgresql://identity:example@rustyred.internal:6543/content",
      }),
    /must not target RustyRed/
  );
  assert.throws(
    () =>
      assertIdentityDatabaseBoundary({
        IDENTITY_DATABASE_URL: runtimeUrl,
        RUSTYRED_PG_URL: runtimeUrl,
      }),
    /must not reuse a RustyRed URL/
  );
  assert.throws(
    () =>
      assertIdentityDatabaseBoundary(
        {
          IDENTITY_DATABASE_URL: runtimeUrl,
        },
        { forMigration: true }
      ),
    /IDENTITY_DIRECT_DATABASE_URL is required/
  );
  assert.throws(
    () =>
      assertIdentityDatabaseBoundary(
        {
          IDENTITY_DATABASE_URL:
            "postgresql://runtime:example@pgbouncer.internal:6432/commonplace?connection_limit=4",
          IDENTITY_DIRECT_DATABASE_URL:
            "postgresql://migrator:example@pgbouncer.internal:6432/commonplace",
        },
        { forMigration: true }
      ),
    /must bypass the runtime PgBouncer endpoint/
  );
});

test("runtime factory validates the boundary before constructing Prisma", async () => {
  let constructions = 0;
  class FakePrismaClient {
    constructor() {
      constructions += 1;
      Object.assign(this, makePrismaClient("factory"));
    }
  }

  assert.throws(
    () =>
      createIdentityService({
        environment: {},
        PrismaClientImpl: FakePrismaClient,
      }),
    /IDENTITY_DATABASE_URL is required/
  );
  assert.equal(constructions, 0);

  const options = {
    environment: {
      IDENTITY_DATABASE_URL:
        "postgresql://identity:example@pgbouncer.internal:6432/commonplace",
    },
    PrismaClientImpl: FakePrismaClient,
  };
  const first = getIdentityService(options);
  const second = getIdentityService(options);
  assert.equal(first, second);
  assert.equal(constructions, 1);
  assert.equal(first.workspace.marker, "factory:workspace");
  assert.throws(() => first.$queryRaw, IdentityAccessViolation);

  await disconnectIdentityService();
  const replacement = getIdentityService(options);
  assert.notEqual(replacement, first);
  assert.equal(constructions, 2);
  await disconnectIdentityService();
});
