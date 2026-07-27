"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  IdentityOperationError,
  createIdentityOperations,
  tokenHash,
} = require("../../../utils/identity/operations");

const PEPPER = "identity-test-pepper-that-is-longer-than-thirty-two-characters";
const NOW = new Date("2026-07-27T12:00:00.000Z");

function createMemoryAccess() {
  const rows = {
    user: [],
    workspace: [],
    role: [],
    workspaceMembership: [],
    invite: [],
    apiKey: [],
  };
  let sequence = 0;
  const nextId = (prefix) => `${prefix}-${++sequence}`;
  const createdAt = () => new Date(NOW);
  const matchWhere = (record, where) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "workspaceId_userId") {
        return (
          record.workspaceId === value.workspaceId && record.userId === value.userId
        );
      }
      if (key === "workspaceId_key") {
        return record.workspaceId === value.workspaceId && record.key === value.key;
      }
      if (value && typeof value === "object" && "gt" in value) {
        return record[key] > value.gt;
      }
      return record[key] === value;
    });
  const includeRelations = (record, include = {}) => {
    if (!record) return null;
    const result = { ...record };
    if (include.workspace) {
      result.workspace =
        rows.workspace.find((entry) => entry.id === record.workspaceId) ?? null;
    }
    if (include.role) {
      result.role = rows.role.find((entry) => entry.id === record.roleId) ?? null;
    }
    if (include.user) {
      result.user = rows.user.find((entry) => entry.id === record.userId) ?? null;
    }
    return result;
  };
  const order = (records, orderBy) => {
    if (!orderBy) return records;
    const [[key, direction]] = Object.entries(orderBy);
    return [...records].sort((left, right) => {
      const comparison = left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0;
      return direction === "desc" ? -comparison : comparison;
    });
  };

  const access = {
    rows,
    async withTransaction(callback) {
      return callback(access);
    },
    user: {
      async findUnique({ where }) {
        return rows.user.find((record) => matchWhere(record, where)) ?? null;
      },
      async create({ data }) {
        if (
          rows.user.some(
            (record) =>
              record.username === data.username ||
              record.providerSubject === data.providerSubject
          )
        ) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const record = {
          id: nextId("user"),
          status: "ACTIVE",
          passwordHash: null,
          createdAt: createdAt(),
          updatedAt: createdAt(),
          ...data,
        };
        rows.user.push(record);
        return record;
      },
      async update({ where, data }) {
        const record = rows.user.find((entry) => matchWhere(entry, where));
        Object.assign(record, data, { updatedAt: createdAt() });
        return record;
      },
      async findMany({ orderBy } = {}) {
        return order(rows.user, orderBy);
      },
    },
    workspace: {
      async create({ data }) {
        if (
          rows.workspace.some(
            (record) => record.tenant === data.tenant && record.slug === data.slug
          )
        ) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const record = {
          createdAt: createdAt(),
          updatedAt: createdAt(),
          ...data,
        };
        rows.workspace.push(record);
        return record;
      },
      async update({ where, data }) {
        const record = rows.workspace.find((entry) => matchWhere(entry, where));
        Object.assign(record, data, { updatedAt: createdAt() });
        return record;
      },
      async updateMany({ where, data }) {
        const matches = rows.workspace.filter((entry) => matchWhere(entry, where));
        matches.forEach((entry) => Object.assign(entry, data, { updatedAt: createdAt() }));
        return { count: matches.length };
      },
      async findMany({ orderBy } = {}) {
        return order(rows.workspace, orderBy);
      },
    },
    role: {
      async create({ data }) {
        const record = {
          createdAt: createdAt(),
          updatedAt: createdAt(),
          ...data,
        };
        rows.role.push(record);
        return record;
      },
      async findUnique({ where }) {
        return rows.role.find((record) => matchWhere(record, where)) ?? null;
      },
    },
    workspaceMembership: {
      async findMany({ where, include, orderBy }) {
        return order(
          rows.workspaceMembership
            .filter((record) => matchWhere(record, where))
            .map((record) => includeRelations(record, include)),
          orderBy
        );
      },
      async findUnique({ where, include }) {
        return includeRelations(
          rows.workspaceMembership.find((record) => matchWhere(record, where)),
          include
        );
      },
      async create({ data, include }) {
        const record = {
          id: nextId("membership"),
          status: "ACTIVE",
          createdAt: createdAt(),
          updatedAt: createdAt(),
          ...data,
        };
        rows.workspaceMembership.push(record);
        return includeRelations(record, include);
      },
      async upsert({ where, create, update, include }) {
        let record = rows.workspaceMembership.find((entry) =>
          matchWhere(entry, where)
        );
        if (record) Object.assign(record, update, { updatedAt: createdAt() });
        else {
          record = {
            id: nextId("membership"),
            status: "ACTIVE",
            createdAt: createdAt(),
            updatedAt: createdAt(),
            ...create,
          };
          rows.workspaceMembership.push(record);
        }
        return includeRelations(record, include);
      },
    },
    invite: {
      async create({ data, include }) {
        const record = {
          id: nextId("invite"),
          status: "PENDING",
          claimedById: null,
          claimedAt: null,
          createdAt: createdAt(),
          ...data,
        };
        rows.invite.push(record);
        return includeRelations(record, include);
      },
      async findUnique({ where, include }) {
        return includeRelations(
          rows.invite.find((record) => matchWhere(record, where)),
          include
        );
      },
      async updateMany({ where, data }) {
        const matches = rows.invite.filter((record) => matchWhere(record, where));
        matches.forEach((record) => Object.assign(record, data));
        return { count: matches.length };
      },
      async findMany({ where, include, orderBy }) {
        return order(
          rows.invite
            .filter((record) => matchWhere(record, where))
            .map((record) => includeRelations(record, include)),
          orderBy
        );
      },
    },
    apiKey: {
      async create({ data }) {
        const record = {
          id: nextId("api-key"),
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: createdAt(),
          ...data,
        };
        rows.apiKey.push(record);
        return record;
      },
      async findUnique({ where, include }) {
        return includeRelations(
          rows.apiKey.find((record) => matchWhere(record, where)),
          include
        );
      },
      async findMany({ where, orderBy }) {
        return order(
          rows.apiKey.filter((record) => matchWhere(record, where)),
          orderBy
        );
      },
      async update({ where, data }) {
        const record = rows.apiKey.find((entry) => matchWhere(entry, where));
        Object.assign(record, data);
        return record;
      },
    },
  };

  return access;
}

function principal(subject, username, email = null) {
  return {
    subject: `github:${subject}`,
    username,
    displayName: username,
    email,
  };
}

function operationsFixture() {
  const access = createMemoryAccess();
  let uuid = 0;
  let random = 0;
  const operations = createIdentityOperations(access, {
    tokenPepper: PEPPER,
    clock: () => new Date(NOW),
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    randomBytes: (size) => Buffer.alloc(size, ++random),
  });
  return { access, operations };
}

test("reconciles a stable provider subject and preserves admitted tenant casing", async () => {
  const { access, operations } = operationsFixture();
  const initial = await operations.reconcilePrincipal(
    principal("42", "Travis-Gilbert", "TRAVIS@example.test")
  );
  assert.equal(initial.user.username, "Travis-Gilbert");
  assert.equal(initial.user.email, "travis@example.test");
  assert.equal(initial.onboardingComplete, false);

  const workspace = await operations.createWorkspace(
    principal("42", "Travis-Gilbert", "travis@example.test"),
    { name: "Research", slug: "research" }
  );
  assert.equal(workspace.tenant, "Travis-Gilbert");
  assert.match(workspace.scopeRef, /^workspace:00000000-/);

  const corrected = await operations.reconcilePrincipal(
    principal("42", "TRAVIS-GILBERT", "travis@example.test")
  );
  assert.equal(corrected.user.username, "TRAVIS-GILBERT");
  assert.equal(corrected.workspaces[0].tenant, "TRAVIS-GILBERT");
  assert.equal(corrected.workspaces[0].scopeRef, workspace.scopeRef);
  assert.equal(access.rows.workspace[0].tenant, "TRAVIS-GILBERT");

  await assert.rejects(
    operations.reconcilePrincipal(principal("42", "renamed-owner")),
    (error) =>
      error instanceof IdentityOperationError &&
      error.code === "identity_rename_requires_migration"
  );
});

test("isolates workspaces by membership and completes a single-use invitation", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert", "owner@example.test");
  const member = principal("2", "second-user", "member@example.test");
  const workspace = await operations.createWorkspace(owner, {
    name: "Private research",
    slug: "private-research",
  });
  const before = await operations.listWorkspaces(member);
  assert.deepEqual(before.workspaces, []);

  const created = await operations.createInvite(owner, workspace.id, {
    email: "member@example.test",
  });
  assert.match(created.code, /^cp_inv_/);
  assert.equal(created.invite.workspace.id, workspace.id);
  assert.equal((await operations.inspectInvite(created.code)).role.key, "member");

  const accepted = await operations.acceptInvite(member, created.code);
  assert.equal(accepted.id, workspace.id);
  assert.equal(accepted.role.key, "member");
  assert.deepEqual(
    (await operations.listWorkspaces(member)).workspaces.map((entry) => entry.id),
    [workspace.id]
  );
  await assert.rejects(
    operations.acceptInvite(member, created.code),
    (error) => error.code === "invite_invalid"
  );
  await assert.rejects(
    operations.createInvite(member, workspace.id, {}),
    (error) => error.code === "workspace_permission_refused"
  );

  assert.deepEqual(
    await operations.resolveWorkspaceContentScope(member, workspace.id),
    {
      tenant: "Travis-Gilbert",
      workspaceId: workspace.id,
      scopeRef: workspace.scopeRef,
    }
  );

  const secondInvite = await operations.createInvite(owner, workspace.id, {
    email: "member@example.test",
  });
  const memberUser = access.rows.user.find(
    (user) => user.providerSubject === "github:2"
  );
  const memberMembership = access.rows.workspaceMembership.find(
    (membership) =>
      membership.workspaceId === workspace.id &&
      membership.userId === memberUser.id
  );
  memberMembership.status = "SUSPENDED";
  await assert.rejects(
    operations.acceptInvite(member, secondInvite.code),
    (error) => error.code === "membership_suspended"
  );
  assert.equal(
    (await operations.inspectInvite(secondInvite.code)).status,
    "PENDING"
  );
});

test("content scope resolution requires graph write membership", async () => {
  const { operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const outsider = principal("2", "outside-user");
  const workspace = await operations.createWorkspace(owner, {
    name: "Scoped",
    slug: "scoped",
  });

  await assert.rejects(
    operations.resolveWorkspaceContentScope(outsider, workspace.id),
    (error) => error.code === "workspace_permission_refused"
  );
  assert.deepEqual(
    await operations.resolveWorkspaceContentScope(owner, workspace.id),
    {
      tenant: "Travis-Gilbert",
      workspaceId: workspace.id,
      scopeRef: workspace.scopeRef,
    }
  );
});

test("stores only API key hashes, authenticates scope, and enforces revocation", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Keys",
    slug: "keys",
  });
  const created = await operations.createApiKey(owner, workspace.id, {
    name: "Widget",
    scopes: ["workspace.read", "content.read"],
  });
  assert.match(created.key, /^cpk_[a-f0-9]{8}_/);
  assert.equal(access.rows.apiKey[0].keyHash, tokenHash(created.key, PEPPER));
  assert.equal(JSON.stringify(access.rows.apiKey).includes(created.key), false);

  assert.deepEqual(await operations.authenticateApiKey(created.key), {
    userId: access.rows.user[0].id,
    workspaceId: workspace.id,
    tenant: "Travis-Gilbert",
    scopeRef: workspace.scopeRef,
    scopes: ["workspace.read", "content.read"],
  });
  assert.equal(
    (await operations.listApiKeys(owner, workspace.id))[0].lastUsedAt,
    NOW.toISOString()
  );

  access.rows.workspaceMembership[0].status = "SUSPENDED";
  await assert.rejects(
    operations.authenticateApiKey(created.key),
    (error) => error.code === "api_key_refused"
  );
  access.rows.workspaceMembership[0].status = "ACTIVE";

  await operations.revokeApiKey(owner, created.record.id);
  await assert.rejects(
    operations.authenticateApiKey(created.key),
    (error) => error.code === "api_key_refused"
  );
});

test("admin overview uses exact login admission", async () => {
  const { operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  await operations.createWorkspace(owner, { name: "Admin", slug: "admin" });

  const overview = await operations.adminOverview(owner, ["Travis-Gilbert"]);
  assert.equal(overview.users.length, 1);
  assert.equal(overview.workspaces.length, 1);
  await assert.rejects(
    operations.adminOverview(owner, ["travis-gilbert"]),
    (error) => error.code === "admin_permission_refused"
  );
});
