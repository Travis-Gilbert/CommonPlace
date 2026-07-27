"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADMIN_OVERVIEW_LIMIT,
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
  const calls = {
    apiKeyFindUnique: 0,
    apiKeyUpdate: 0,
    events: [],
    inviteFindMany: [],
    userFindMany: [],
    workspaceFindMany: [],
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
  const take = (records, count) =>
    Number.isInteger(count) ? records.slice(0, count) : records;
  const insertUser = (data) => {
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
  };

  const access = {
    calls,
    rows,
    async withTransaction(callback) {
      return callback(access);
    },
    user: {
      async findUnique({ where }) {
        return rows.user.find((record) => matchWhere(record, where)) ?? null;
      },
      async create({ data }) {
        return insertUser(data);
      },
      async upsert({ where, create, update }) {
        const record =
          rows.user.find((entry) => matchWhere(entry, where)) ?? null;
        if (!record) return insertUser(create);
        if (Object.keys(update).length > 0) {
          Object.assign(record, update, { updatedAt: createdAt() });
        }
        return record;
      },
      async update({ where, data }) {
        const record = rows.user.find((entry) => matchWhere(entry, where));
        Object.assign(record, data, { updatedAt: createdAt() });
        return record;
      },
      async findMany(options = {}) {
        calls.userFindMany.push(options);
        return take(order(rows.user, options.orderBy), options.take);
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
      async findMany(options = {}) {
        calls.workspaceFindMany.push(options);
        return take(order(rows.workspace, options.orderBy), options.take);
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
        calls.events.push("workspaceMembership.findUnique");
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
      async findMany(options = {}) {
        calls.inviteFindMany.push(options);
        return take(
          order(
            rows.invite
              .filter((record) => matchWhere(record, options.where))
              .map((record) => includeRelations(record, options.include)),
            options.orderBy
          ),
          options.take
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
        calls.apiKeyFindUnique += 1;
        calls.events.push("apiKey.findUnique");
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
        calls.apiKeyUpdate += 1;
        calls.events.push("apiKey.update");
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

function operationsFixture({ clock = () => new Date(NOW) } = {}) {
  const access = createMemoryAccess();
  let uuid = 0;
  let random = 0;
  const operations = createIdentityOperations(access, {
    tokenPepper: PEPPER,
    clock,
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

test("atomically claims one user for concurrent principal reconciliation", async () => {
  const { access, operations } = operationsFixture();
  const providerPrincipal = principal(
    "concurrent-42",
    "concurrent-user",
    "concurrent@example.test"
  );

  const [first, second] = await Promise.all([
    operations.reconcilePrincipal(providerPrincipal),
    operations.reconcilePrincipal(providerPrincipal),
  ]);

  assert.equal(access.rows.user.length, 1);
  assert.equal(first.user.id, second.user.id);
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
  assert.match(created.code, /^cp_inv_[A-Za-z0-9_-]{43}$/);
  assert.equal(created.invite.workspace.id, workspace.id);
  assert.equal(created.invite.email, "member@example.test");
  const inspected = await operations.inspectInvite(created.code);
  assert.equal(inspected.role.key, "member");
  assert.equal(inspected.email, null);

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

test("accepting a lower-role invitation preserves an active owner membership", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert", "owner@example.test");
  const workspace = await operations.createWorkspace(owner, {
    name: "Owner role",
    slug: "owner-role",
  });
  const created = await operations.createInvite(owner, workspace.id, {
    email: "owner@example.test",
  });

  const accepted = await operations.acceptInvite(owner, created.code);

  assert.equal(accepted.role.key, "owner");
  assert.equal(
    access.rows.workspaceMembership.find(
      (membership) => membership.workspaceId === workspace.id
    ).roleId,
    access.rows.role.find(
      (role) => role.workspaceId === workspace.id && role.key === "owner"
    ).id
  );
  assert.equal(access.rows.invite[0].status, "CLAIMED");
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
  assert.match(created.key, /^cpk_[a-f0-9]{8}_[A-Za-z0-9_-]{43}$/);
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

test("defaults API key scopes only when the field is omitted", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Scope validation",
    slug: "scope-validation",
  });

  const created = await operations.createApiKey(owner, workspace.id, {});
  assert.deepEqual(created.record.scopes, [
    "workspace.read",
    "content.read",
    "chat.write",
  ]);

  for (const scopes of [null, "workspace.read", { scope: "workspace.read" }]) {
    await assert.rejects(
      operations.createApiKey(owner, workspace.id, { scopes }),
      (error) =>
        error instanceof IdentityOperationError &&
        error.status === 400 &&
        error.code === "api_key_scope_invalid"
    );
  }
  assert.equal(access.rows.apiKey.length, 1);
});

test("rejects invalid API key records before membership lookup", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Refused keys",
    slug: "refused-keys",
  });
  const created = await operations.createApiKey(owner, workspace.id);
  const record = access.rows.apiKey[0];
  const user = access.rows.user[0];
  const membership = access.rows.workspaceMembership[0];
  const workspaceRecord = access.rows.workspace[0];

  async function expectRefusalBeforeMembership() {
    access.calls.events.length = 0;
    await assert.rejects(
      operations.authenticateApiKey(created.key),
      (error) => error.code === "api_key_refused"
    );
    assert.deepEqual(access.calls.events, ["apiKey.findUnique"]);
  }

  record.revokedAt = new Date(NOW);
  await expectRefusalBeforeMembership();
  record.revokedAt = null;

  record.expiresAt = new Date(NOW.getTime() - 1);
  await expectRefusalBeforeMembership();
  record.expiresAt = null;

  user.status = "DISABLED";
  await expectRefusalBeforeMembership();
  user.status = "ACTIVE";

  access.rows.workspace.length = 0;
  await expectRefusalBeforeMembership();
  access.rows.workspace.push(workspaceRecord);

  membership.status = "SUSPENDED";
  access.calls.events.length = 0;
  await assert.rejects(
    operations.authenticateApiKey(created.key),
    (error) => error.code === "api_key_refused"
  );
  assert.deepEqual(access.calls.events, [
    "apiKey.findUnique",
    "workspaceMembership.findUnique",
  ]);
});

test("prevalidates API keys and throttles last-used writes", async () => {
  let currentTime = new Date(NOW);
  const { access, operations } = operationsFixture({
    clock: () => new Date(currentTime),
  });
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Throttled keys",
    slug: "throttled-keys",
  });
  const created = await operations.createApiKey(owner, workspace.id);

  const lookupsBeforeInvalidKey = access.calls.apiKeyFindUnique;
  await assert.rejects(
    operations.authenticateApiKey("not-a-generated-commonplace-api-key"),
    (error) =>
      error instanceof IdentityOperationError &&
      error.status === 401 &&
      error.code === "api_key_refused"
  );
  assert.equal(access.calls.apiKeyFindUnique, lookupsBeforeInvalidKey);

  await operations.authenticateApiKey(created.key);
  assert.equal(access.calls.apiKeyUpdate, 1);

  currentTime = new Date(NOW.getTime() + 60_000);
  await operations.authenticateApiKey(created.key);
  assert.equal(access.calls.apiKeyUpdate, 1);

  currentTime = new Date(NOW.getTime() + 6 * 60_000);
  await operations.authenticateApiKey(created.key);
  assert.equal(access.calls.apiKeyUpdate, 2);
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

test("admin overview excludes expired pending invitations", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Admin invitations",
    slug: "admin-invitations",
  });
  const memberRole = access.rows.role.find(
    (role) => role.workspaceId === workspace.id && role.key === "member"
  );
  const baseInvite = {
    workspaceId: workspace.id,
    roleId: memberRole.id,
    claimedById: null,
    claimedAt: null,
  };
  access.rows.invite.push(
    {
      ...baseInvite,
      id: "active-pending-invite",
      email: "active@example.test",
      status: "PENDING",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: new Date(NOW.getTime() - 1),
    },
    {
      ...baseInvite,
      id: "expired-pending-invite",
      email: "expired@example.test",
      status: "PENDING",
      expiresAt: new Date(NOW.getTime() - 1),
      createdAt: new Date(NOW),
    }
  );

  const overview = await operations.adminOverview(owner, ["Travis-Gilbert"]);

  assert.deepEqual(
    overview.pendingInvites.map((invite) => invite.id),
    ["active-pending-invite"]
  );
  assert.deepEqual(access.calls.inviteFindMany.at(-1).where, {
    status: "PENDING",
    expiresAt: { gt: NOW },
  });
});

test("admin overview bounds every collection and reports truncation", async () => {
  const { access, operations } = operationsFixture();
  const owner = principal("1", "Travis-Gilbert");
  const workspace = await operations.createWorkspace(owner, {
    name: "Admin",
    slug: "admin",
  });
  const memberRole = access.rows.role.find(
    (role) => role.workspaceId === workspace.id && role.key === "member"
  );

  for (let index = 0; index < ADMIN_OVERVIEW_LIMIT; index += 1) {
    const createdAt = new Date(NOW.getTime() + index + 1);
    access.rows.user.push({
      id: `bounded-user-${index}`,
      username: `bounded-user-${index}`,
      displayName: null,
      email: null,
      status: "ACTIVE",
      createdAt,
    });
    access.rows.workspace.push({
      id: `bounded-workspace-${index}`,
      tenant: "Travis-Gilbert",
      slug: `bounded-workspace-${index}`,
      scopeRef: `workspace:bounded-workspace-${index}`,
      name: `Bounded workspace ${index}`,
      createdAt,
    });
  }
  for (let index = 0; index <= ADMIN_OVERVIEW_LIMIT; index += 1) {
    access.rows.invite.push({
      id: `bounded-invite-${index}`,
      workspaceId: workspace.id,
      roleId: memberRole.id,
      email: `invite-${index}@example.test`,
      status: "PENDING",
      expiresAt: new Date(NOW.getTime() + 60_000),
      createdAt: new Date(NOW.getTime() + index),
    });
  }

  const overview = await operations.adminOverview(owner, ["Travis-Gilbert"]);

  assert.equal(overview.users.length, ADMIN_OVERVIEW_LIMIT);
  assert.equal(overview.workspaces.length, ADMIN_OVERVIEW_LIMIT);
  assert.equal(overview.pendingInvites.length, ADMIN_OVERVIEW_LIMIT);
  assert.deepEqual(overview.truncated, {
    users: true,
    workspaces: true,
    pendingInvites: true,
  });
  assert.match(overview.pendingInvites[0].email, /^invite-/);
  assert.equal(
    access.calls.userFindMany.at(-1).take,
    ADMIN_OVERVIEW_LIMIT + 1
  );
  assert.equal(
    access.calls.workspaceFindMany.at(-1).take,
    ADMIN_OVERVIEW_LIMIT + 1
  );
  assert.equal(
    access.calls.inviteFindMany.at(-1).take,
    ADMIN_OVERVIEW_LIMIT + 1
  );
});
