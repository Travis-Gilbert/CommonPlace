"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

const EXPECTED_FIELDS = Object.freeze({
  User: [
    "id",
    "username",
    "email",
    "displayName",
    "passwordHash",
    "status",
    "sessions",
    "apiKeys",
    "memberships",
    "invitesCreated",
    "invitesClaimed",
    "createdAt",
    "updatedAt",
  ],
  Session: [
    "id",
    "userId",
    "tokenHash",
    "expiresAt",
    "lastSeenAt",
    "revokedAt",
    "createdAt",
    "user",
  ],
  ApiKey: [
    "id",
    "userId",
    "workspaceId",
    "name",
    "keyPrefix",
    "keyHash",
    "scopes",
    "expiresAt",
    "revokedAt",
    "lastUsedAt",
    "createdAt",
    "user",
    "workspace",
  ],
  Workspace: [
    "id",
    "tenant",
    "slug",
    "scopeRef",
    "name",
    "memberships",
    "roles",
    "invites",
    "apiKeys",
    "billingAccount",
    "createdAt",
    "updatedAt",
  ],
  WorkspaceMembership: [
    "id",
    "workspaceId",
    "userId",
    "roleId",
    "status",
    "createdAt",
    "updatedAt",
    "workspace",
    "user",
    "role",
  ],
  Role: [
    "id",
    "workspaceId",
    "key",
    "name",
    "permissions",
    "isSystem",
    "memberships",
    "invites",
    "createdAt",
    "updatedAt",
    "workspace",
  ],
  Invite: [
    "id",
    "workspaceId",
    "roleId",
    "createdById",
    "claimedById",
    "tokenHash",
    "email",
    "status",
    "expiresAt",
    "claimedAt",
    "createdAt",
    "workspace",
    "role",
    "createdBy",
    "claimedBy",
  ],
  BillingAccount: [
    "id",
    "workspaceId",
    "provider",
    "providerCustomerId",
    "providerSubscriptionId",
    "productCode",
    "status",
    "seatLimit",
    "currentPeriodEndsAt",
    "createdAt",
    "updatedAt",
    "workspace",
  ],
});

const EXPECTED_TABLES = Object.freeze({
  User: "cp_identity_users",
  Session: "cp_identity_sessions",
  ApiKey: "cp_identity_api_keys",
  Workspace: "cp_identity_workspaces",
  WorkspaceMembership: "cp_identity_workspace_memberships",
  Role: "cp_identity_roles",
  Invite: "cp_identity_invites",
  BillingAccount: "cp_identity_billing_accounts",
});

const EXPECTED_ENUMS = Object.freeze({
  UserStatus: "cp_identity_user_status",
  MembershipStatus: "cp_identity_membership_status",
  InviteStatus: "cp_identity_invite_status",
  BillingStatus: "cp_identity_billing_status",
});

function parseModels(source) {
  const models = new Map();
  const pattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  for (const match of source.matchAll(pattern)) {
    models.set(match[1], match[2]);
  }
  return models;
}

function parseEnums(source) {
  const enums = new Map();
  const pattern = /^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  for (const match of source.matchAll(pattern)) {
    enums.set(match[1], match[2]);
  }
  return enums;
}

function parseFields(modelBody) {
  return modelBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.match(/^(\w+)\s+/)?.[1])
    .filter(Boolean);
}

test("schema is PostgreSQL-only and uses dedicated identity connection variables", () => {
  assert.match(schema, /provider\s*=\s*"postgresql"/);
  assert.match(schema, /url\s*=\s*env\("IDENTITY_DATABASE_URL"\)/);
  assert.match(
    schema,
    /directUrl\s*=\s*env\("IDENTITY_DIRECT_DATABASE_URL"\)/
  );
  assert.doesNotMatch(schema, /provider\s*=\s*"sqlite"/);
  assert.doesNotMatch(schema, /env\("DATABASE_URL"\)/);
  assert.doesNotMatch(schema, /env\("[^"]*RUSTYRED[^"]*"\)/i);
});

test("schema contains exactly the eight FK3 identity models", () => {
  const models = parseModels(schema);

  assert.deepEqual([...models.keys()].sort(), Object.keys(EXPECTED_FIELDS).sort());
});

test("every identity model has a closed field allowlist", () => {
  const models = parseModels(schema);

  for (const [model, expectedFields] of Object.entries(EXPECTED_FIELDS)) {
    assert.deepEqual(
      parseFields(models.get(model)).sort(),
      [...expectedFields].sort(),
      `${model} gained or lost a field; classify its residency explicitly`
    );
  }
});

test("all Prisma-owned tables use the FK3 identity prefix", () => {
  const models = parseModels(schema);
  const tableNames = [];

  for (const [model, expectedTable] of Object.entries(EXPECTED_TABLES)) {
    const tableName = models.get(model).match(/@@map\("([^"]+)"\)/)?.[1];
    assert.equal(tableName, expectedTable);
    tableNames.push(tableName);
    assert.match(tableName, /^cp_identity_[a-z_]+$/);
  }

  assert.equal(new Set(tableNames).size, tableNames.length);
});

test("database enum types use the same FK3 identity namespace", () => {
  const enums = parseEnums(schema);

  assert.deepEqual([...enums.keys()].sort(), Object.keys(EXPECTED_ENUMS).sort());
  for (const [enumName, expectedDatabaseName] of Object.entries(EXPECTED_ENUMS)) {
    const databaseName = enums
      .get(enumName)
      .match(/@@map\("([^"]+)"\)/)?.[1];
    assert.equal(databaseName, expectedDatabaseName);
    assert.match(databaseName, /^cp_identity_[a-z_]+$/);
  }
});

test("schema cannot hide user content in an identity model or generic payload", () => {
  const forbiddenFieldFragments = [
    "artifact",
    "blob",
    "body",
    "chat",
    "content",
    "document",
    "embedding",
    "graph",
    "memory",
    "message",
    "plan",
    "prompt",
    "receipt",
    "response",
    "vector",
  ];

  for (const [model, fields] of Object.entries(EXPECTED_FIELDS)) {
    for (const field of fields) {
      const normalized = field.toLowerCase();
      for (const fragment of forbiddenFieldFragments) {
        assert.equal(
          normalized.includes(fragment),
          false,
          `${model}.${field} contains forbidden residency term "${fragment}"`
        );
      }
    }
  }

  assert.doesNotMatch(schema, /\sJson(?:\?|\[\])?(?:\s|$)/m);
  assert.doesNotMatch(schema, /\sBytes(?:\?|\[\])?(?:\s|$)/m);
  assert.doesNotMatch(schema, /@db\.Text\b/);
});

test("credentials and claim tokens are represented only by hashes", () => {
  const models = parseModels(schema);

  assert.match(models.get("User"), /^\s*passwordHash\s+/m);
  assert.match(models.get("Session"), /^\s*tokenHash\s+/m);
  assert.match(models.get("ApiKey"), /^\s*keyHash\s+/m);
  assert.match(models.get("Invite"), /^\s*tokenHash\s+/m);

  for (const [model, body] of models) {
    assert.doesNotMatch(
      body,
      /^\s*(?:password|token|secret|apiKey)\s+/m,
      `${model} stores a raw credential or claim token`
    );
  }
});

test("workspace identity durably binds tenant casing and one graph scope", () => {
  const workspace = parseModels(schema).get("Workspace");

  assert.match(workspace, /tenant\s+String\s+@db\.VarChar\(160\)/);
  assert.match(
    workspace,
    /scopeRef\s+String\s+@unique\s+@map\("scope_ref"\)\s+@db\.VarChar\(255\)/
  );
  assert.match(workspace, /@@unique\(\[tenant,\s*slug\]\)/);
  assert.doesNotMatch(workspace, /slug\s+String\s+@unique/);
});

test("workspace authorization records cannot reference a role from another workspace", () => {
  const models = parseModels(schema);
  const workspaceRoleRelation =
    /role\s+Role\s+@relation\(fields: \[roleId, workspaceId\], references: \[id, workspaceId\], onDelete: Restrict\)/;

  assert.match(models.get("Role"), /@@unique\(\[id, workspaceId\]\)/);
  assert.match(models.get("WorkspaceMembership"), workspaceRoleRelation);
  assert.match(models.get("Invite"), workspaceRoleRelation);
});
