"use strict";

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=server/models/{user,workspace,workspaceUsers,invite,apiKeys}.js.
// Adapted under MIT into the FK3 PostgreSQL identity bulkhead. No content
// model or user-authored payload is admitted here.

const {
  createHash,
  randomBytes: nodeRandomBytes,
  randomUUID: nodeRandomUUID,
} = require("node:crypto");

const API_KEY_SCOPES = Object.freeze([
  "workspace.read",
  "content.read",
  "content.write",
  "chat.write",
]);
const ADMIN_OVERVIEW_LIMIT = 100;
const API_KEY_LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const API_KEY_PATTERN = /^cpk_[a-f0-9]{8}_[A-Za-z0-9_-]{43}$/;
const INVITE_EMAIL_PATTERN =
  /^(?![\s\S]*\s)[^@]+@[^@.]+(?:\.[^@.]+)+$/;
const OWNER_PERMISSIONS = Object.freeze([
  "workspace.read",
  "workspace.manage",
  "members.manage",
  "keys.manage",
  ...API_KEY_SCOPES.slice(1),
]);
const MEMBER_PERMISSIONS = Object.freeze([
  "workspace.read",
  "content.read",
  "content.write",
  "chat.write",
]);

class IdentityOperationError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "IdentityOperationError";
    this.status = status;
    this.code = code;
  }
}

function requiredText(value, name, maxLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new IdentityOperationError(400, "identity_input_invalid", `${name} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new IdentityOperationError(
      400,
      "identity_input_invalid",
      `${name} is too long`
    );
  }
  return normalized;
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, name, maxLength);
}

function normalizeInviteEmail(value) {
  const email = optionalText(value, "invite.email", 320)?.toLowerCase() ?? null;
  if (
    email &&
    (value !== value.trim() || !INVITE_EMAIL_PATTERN.test(email))
  ) {
    throw new IdentityOperationError(
      400,
      "invite_email_invalid",
      "The invitation email address is invalid"
    );
  }
  return email;
}

function normalizePrincipal(input) {
  const subject = requiredText(input?.subject, "principal.subject", 160);
  const username = requiredText(input?.username, "principal.username", 64);
  const displayName = optionalText(input?.displayName, "principal.displayName", 120);
  const email = optionalText(input?.email, "principal.email", 320);

  if (!/^github:[A-Za-z0-9._:-]+$/.test(subject)) {
    throw new IdentityOperationError(
      400,
      "identity_subject_invalid",
      "Only a verified GitHub provider subject is admitted"
    );
  }
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) {
    throw new IdentityOperationError(
      400,
      "identity_username_invalid",
      "The verified GitHub login is invalid"
    );
  }

  return Object.freeze({
    subject,
    username,
    displayName,
    email: email?.toLowerCase() ?? null,
  });
}

function normalizeWorkspaceSlug(value) {
  const slug = requiredText(value, "workspace.slug", 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    throw new IdentityOperationError(
      400,
      "workspace_slug_invalid",
      "Workspace slugs use lowercase letters, numbers, and interior hyphens"
    );
  }
  return slug;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    status: user.status,
  };
}

function publicWorkspaceMembership(membership) {
  return {
    id: membership.workspace.id,
    tenant: membership.workspace.tenant,
    slug: membership.workspace.slug,
    scopeRef: membership.workspace.scopeRef,
    name: membership.workspace.name,
    role: {
      key: membership.role.key,
      name: membership.role.name,
      permissions: [...membership.role.permissions],
    },
  };
}

// Invite and API-key bearer values contain 256 random bits. This digest is a
// deterministic lookup key, not a password verifier; the pepper also isolates
// deployments. Any digest change requires a versioned or dual-read migration.
function tokenHash(token, pepper) {
  return createHash("sha256")
    .update(pepper)
    .update("\0")
    .update(token)
    .digest("hex");
}

function publicInvite(invite, { includeEmail = false } = {}) {
  return {
    id: invite.id,
    workspace: {
      id: invite.workspace.id,
      tenant: invite.workspace.tenant,
      slug: invite.workspace.slug,
      name: invite.workspace.name,
    },
    role: {
      id: invite.role.id,
      key: invite.role.key,
      name: invite.role.name,
    },
    email: includeEmail ? invite.email ?? null : null,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

function nowDate(clock) {
  const value = clock();
  return value instanceof Date ? value : new Date(value);
}

function isActiveAt(record, now) {
  return (
    record.status === "PENDING" &&
    record.expiresAt instanceof Date &&
    record.expiresAt.getTime() > now.getTime()
  );
}

function requirePermission(membership, permission) {
  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    !membership.role.permissions.includes(permission)
  ) {
    throw new IdentityOperationError(
      403,
      "workspace_permission_refused",
      `Workspace permission ${permission} is required`
    );
  }
}

function mapDatabaseError(error) {
  if (error instanceof IdentityOperationError) return error;
  if (error?.code === "P2023") {
    return new IdentityOperationError(
      400,
      "identity_input_invalid",
      "An identity identifier is invalid"
    );
  }
  if (error?.code === "P2002") {
    return new IdentityOperationError(
      409,
      "identity_record_conflict",
      "An identity record with this value already exists"
    );
  }
  if (error?.code === "P2003") {
    return new IdentityOperationError(
      409,
      "identity_relation_conflict",
      "An identity relation conflicts with the current workspace state"
    );
  }
  if (error?.code === "P2025") {
    return new IdentityOperationError(
      404,
      "identity_record_missing",
      "The requested identity record does not exist"
    );
  }
  return error;
}

function withDatabaseMapping(operation) {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  };
}

function createIdentityOperations(
  access,
  {
    tokenPepper,
    clock = () => new Date(),
    randomBytes = nodeRandomBytes,
    randomUUID = nodeRandomUUID,
    inviteTtlMs = 7 * 24 * 60 * 60 * 1000,
  } = {}
) {
  const pepper = requiredText(tokenPepper, "IDENTITY_TOKEN_PEPPER", 512);
  if (pepper.length < 32 || /^(?:change-me|example|test)$/i.test(pepper)) {
    throw new Error("IDENTITY_TOKEN_PEPPER must be a non-placeholder value of at least 32 characters");
  }

  async function membershipsFor(transaction, userId) {
    return transaction.workspaceMembership.findMany({
      where: { userId, status: "ACTIVE" },
      include: { workspace: true, role: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async function reconcilePrincipal(input) {
    const principal = normalizePrincipal(input);
    try {
      return await access.withTransaction(async (transaction) => {
        let user = await transaction.user.findUnique({
          where: { providerSubject: principal.subject },
        });

        if (!user) {
          // Verified GitHub login owns the username. Reclaim a stale subject
          // left by probes or prior provider-account drift instead of 409ing.
          const byUsername = await transaction.user.findUnique({
            where: { username: principal.username },
          });
          if (byUsername) {
            user = await transaction.user.update({
              where: { id: byUsername.id },
              data: { providerSubject: principal.subject },
            });
          } else {
            try {
              user = await transaction.user.create({
                data: {
                  authProvider: "github",
                  providerSubject: principal.subject,
                  username: principal.username,
                  displayName: principal.displayName,
                  email: principal.email,
                },
              });
            } catch (error) {
              if (error?.code !== "P2002") throw error;
              user = await transaction.user.findUnique({
                where: { providerSubject: principal.subject },
              });
              if (!user) {
                const racedUsername = await transaction.user.findUnique({
                  where: { username: principal.username },
                });
                if (!racedUsername) throw error;
                user = await transaction.user.update({
                  where: { id: racedUsername.id },
                  data: { providerSubject: principal.subject },
                });
              }
            }
          }
        }

        if (user.username !== principal.username) {
          throw new IdentityOperationError(
            409,
            "identity_rename_requires_migration",
            "A GitHub login rename requires an explicit tenant migration"
          );
        }
        const changed =
          user.displayName !== principal.displayName ||
          user.email !== principal.email;
        if (changed) {
          user = await transaction.user.update({
            where: { id: user.id },
            data: {
              displayName: principal.displayName,
              email: principal.email,
            },
          });
        }

        if (user.status !== "ACTIVE") {
          throw new IdentityOperationError(
            403,
            "identity_user_inactive",
            "This identity is not active"
          );
        }

        const memberships = await membershipsFor(transaction, user.id);
        return {
          user: publicUser(user),
          workspaces: memberships.map(publicWorkspaceMembership),
          onboardingComplete: memberships.length > 0,
        };
      });
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async function listWorkspaces(principalInput) {
    return reconcilePrincipal(principalInput);
  }

  async function createWorkspace(principalInput, input) {
    const session = await reconcilePrincipal(principalInput);
    const slug = normalizeWorkspaceSlug(input?.slug);
    const name = requiredText(input?.name, "workspace.name", 160);
    const workspaceId = randomUUID();
    const ownerRoleId = randomUUID();
    const memberRoleId = randomUUID();

    try {
      return await access.withTransaction(async (transaction) => {
        const workspace = await transaction.workspace.create({
          data: {
            id: workspaceId,
            tenant: session.user.username,
            slug,
            scopeRef: `workspace:${workspaceId}`,
            name,
          },
        });
        const ownerRole = await transaction.role.create({
          data: {
            id: ownerRoleId,
            workspaceId,
            key: "owner",
            name: "Owner",
            permissions: [...OWNER_PERMISSIONS],
            isSystem: true,
          },
        });
        await transaction.role.create({
          data: {
            id: memberRoleId,
            workspaceId,
            key: "member",
            name: "Member",
            permissions: [...MEMBER_PERMISSIONS],
            isSystem: true,
          },
        });
        const membership = await transaction.workspaceMembership.create({
          data: {
            workspaceId,
            userId: session.user.id,
            roleId: ownerRoleId,
          },
          include: { workspace: true, role: true },
        });
        return publicWorkspaceMembership({
          ...membership,
          workspace,
          role: ownerRole,
        });
      });
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async function membershipFor(transaction, userId, workspaceId) {
    return transaction.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true, role: true },
    });
  }

  async function updateWorkspace(principalInput, workspaceIdInput, input) {
    const session = await reconcilePrincipal(principalInput);
    const workspaceId = requiredText(workspaceIdInput, "workspace.id", 80);
    const name = requiredText(input?.name, "workspace.name", 160);
    return access.withTransaction(async (transaction) => {
      const membership = await membershipFor(
        transaction,
        session.user.id,
        workspaceId
      );
      requirePermission(membership, "workspace.manage");
      const workspace = await transaction.workspace.update({
        where: { id: workspaceId },
        data: { name },
      });
      return publicWorkspaceMembership({ ...membership, workspace });
    });
  }

  async function resolveWorkspaceContentScope(principalInput, workspaceIdInput) {
    const session = await reconcilePrincipal(principalInput);
    const workspaceId = requiredText(workspaceIdInput, "workspace.id", 80);
    return access.withTransaction(async (transaction) => {
      const membership = await membershipFor(
        transaction,
        session.user.id,
        workspaceId
      );
      requirePermission(membership, "content.write");
      return Object.freeze({
        tenant: membership.workspace.tenant,
        workspaceId: membership.workspace.id,
        scopeRef: membership.workspace.scopeRef,
      });
    });
  }

  async function createInvite(principalInput, workspaceIdInput, input = {}) {
    const session = await reconcilePrincipal(principalInput);
    const workspaceId = requiredText(workspaceIdInput, "workspace.id", 80);
    const email = normalizeInviteEmail(input.email);
    const code = `cp_inv_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(nowDate(clock).getTime() + inviteTtlMs);

    return access.withTransaction(async (transaction) => {
      const membership = await membershipFor(
        transaction,
        session.user.id,
        workspaceId
      );
      requirePermission(membership, "members.manage");
      const role = input.roleKey
        ? await transaction.role.findUnique({
            where: {
              workspaceId_key: {
                workspaceId,
                key: requiredText(input.roleKey, "invite.roleKey", 64),
              },
            },
          })
        : await transaction.role.findUnique({
            where: { workspaceId_key: { workspaceId, key: "member" } },
          });
      if (!role) {
        throw new IdentityOperationError(
          404,
          "invite_role_missing",
          "The requested workspace role does not exist"
        );
      }
      const invite = await transaction.invite.create({
        data: {
          workspaceId,
          roleId: role.id,
          createdById: session.user.id,
          tokenHash: tokenHash(code, pepper),
          email,
          expiresAt,
        },
        include: { workspace: true, role: true },
      });
      return {
        invite: publicInvite(invite, { includeEmail: true }),
        code,
      };
    });
  }

  async function inspectInvite(codeInput) {
    const code = requiredText(codeInput, "invite.code", 160);
    const invite = await access.invite.findUnique({
      where: { tokenHash: tokenHash(code, pepper) },
      include: { workspace: true, role: true },
    });
    if (!invite || !isActiveAt(invite, nowDate(clock))) {
      throw new IdentityOperationError(
        404,
        "invite_invalid",
        "This invitation is invalid or expired"
      );
    }
    return publicInvite(invite);
  }

  async function acceptInvite(principalInput, codeInput) {
    const session = await reconcilePrincipal(principalInput);
    const code = requiredText(codeInput, "invite.code", 160);

    return access.withTransaction(async (transaction) => {
      const invite = await transaction.invite.findUnique({
        where: { tokenHash: tokenHash(code, pepper) },
        include: { workspace: true, role: true },
      });
      if (!invite || !isActiveAt(invite, nowDate(clock))) {
        throw new IdentityOperationError(
          404,
          "invite_invalid",
          "This invitation is invalid or expired"
        );
      }
      if (
        invite.email &&
        (!session.user.email ||
          invite.email.toLowerCase() !== session.user.email.toLowerCase())
      ) {
        throw new IdentityOperationError(
          403,
          "invite_email_refused",
          "This invitation belongs to a different verified email"
        );
      }
      const existingMembership = await membershipFor(
        transaction,
        session.user.id,
        invite.workspaceId
      );
      if (existingMembership && existingMembership.status !== "ACTIVE") {
        throw new IdentityOperationError(
          403,
          "membership_suspended",
          "A suspended membership cannot be restored by invitation"
        );
      }
      const claimed = await transaction.invite.updateMany({
        where: {
          id: invite.id,
          status: "PENDING",
          claimedById: null,
          expiresAt: { gt: nowDate(clock) },
        },
        data: {
          status: "CLAIMED",
          claimedById: session.user.id,
          claimedAt: nowDate(clock),
        },
      });
      if (claimed.count !== 1) {
        throw new IdentityOperationError(
          409,
          "invite_already_claimed",
          "This invitation was already claimed"
        );
      }
      const membership = await transaction.workspaceMembership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: session.user.id,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          roleId: invite.roleId,
        },
        update: {
          // Accepting another invitation must never reduce an existing active
          // member's authority (for example, owner -> member). Suspended
          // memberships have already been refused above.
          status: "ACTIVE",
        },
        include: { workspace: true, role: true },
      });
      return publicWorkspaceMembership(membership);
    });
  }

  async function createApiKey(principalInput, workspaceIdInput, input = {}) {
    const session = await reconcilePrincipal(principalInput);
    const workspaceId = requiredText(workspaceIdInput, "workspace.id", 80);
    if (input.scopes !== undefined && !Array.isArray(input.scopes)) {
      throw new IdentityOperationError(
        400,
        "api_key_scope_invalid",
        "One or more API key scopes are invalid"
      );
    }
    const scopes =
      input.scopes === undefined
        ? ["workspace.read", "content.read", "chat.write"]
        : [
            ...new Set(
              input.scopes.map((scope) =>
                requiredText(scope, "apiKey.scope", 64)
              )
            ),
          ];
    if (
      scopes.length === 0 ||
      scopes.some((scope) => !API_KEY_SCOPES.includes(scope))
    ) {
      throw new IdentityOperationError(
        400,
        "api_key_scope_invalid",
        "One or more API key scopes are invalid"
      );
    }
    const prefix = `cpk_${randomBytes(4).toString("hex")}`;
    const rawKey = `${prefix}_${randomBytes(32).toString("base64url")}`;

    return access.withTransaction(async (transaction) => {
      const membership = await membershipFor(
        transaction,
        session.user.id,
        workspaceId
      );
      requirePermission(membership, "keys.manage");
      const record = await transaction.apiKey.create({
        data: {
          userId: session.user.id,
          workspaceId,
          name: optionalText(input.name, "apiKey.name", 120),
          keyPrefix: prefix,
          keyHash: tokenHash(rawKey, pepper),
          scopes,
        },
      });
      return {
        key: rawKey,
        record: {
          id: record.id,
          name: record.name ?? null,
          prefix: record.keyPrefix,
          scopes: [...record.scopes],
          createdAt: record.createdAt.toISOString(),
          expiresAt: record.expiresAt?.toISOString() ?? null,
        },
      };
    });
  }

  async function listApiKeys(principalInput, workspaceIdInput) {
    const session = await reconcilePrincipal(principalInput);
    const workspaceId = requiredText(workspaceIdInput, "workspace.id", 80);
    return access.withTransaction(async (transaction) => {
      const membership = await membershipFor(
        transaction,
        session.user.id,
        workspaceId
      );
      requirePermission(membership, "keys.manage");
      const records = await transaction.apiKey.findMany({
        where: { workspaceId, revokedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return records.map((record) => ({
        id: record.id,
        name: record.name ?? null,
        prefix: record.keyPrefix,
        scopes: [...record.scopes],
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt?.toISOString() ?? null,
        lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
      }));
    });
  }

  async function revokeApiKey(principalInput, keyIdInput) {
    const session = await reconcilePrincipal(principalInput);
    const keyId = requiredText(keyIdInput, "apiKey.id", 80);
    return access.withTransaction(async (transaction) => {
      const record = await transaction.apiKey.findUnique({ where: { id: keyId } });
      if (!record?.workspaceId) {
        throw new IdentityOperationError(404, "api_key_missing", "API key not found");
      }
      const membership = await membershipFor(
        transaction,
        session.user.id,
        record.workspaceId
      );
      requirePermission(membership, "keys.manage");
      await transaction.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: nowDate(clock) },
      });
      return { revoked: true };
    });
  }

  async function authenticateApiKey(rawKeyInput) {
    if (
      typeof rawKeyInput !== "string" ||
      !API_KEY_PATTERN.test(rawKeyInput)
    ) {
      throw new IdentityOperationError(401, "api_key_refused", "API key refused");
    }
    const rawKey = rawKeyInput;
    const now = nowDate(clock);
    return access.withTransaction(async (transaction) => {
      const record = await transaction.apiKey.findUnique({
        where: { keyHash: tokenHash(rawKey, pepper) },
        include: { user: true, workspace: true },
      });
      if (
        !record ||
        record.revokedAt ||
        (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) ||
        record.user?.status !== "ACTIVE" ||
        !record.workspaceId ||
        !record.workspace
      ) {
        throw new IdentityOperationError(401, "api_key_refused", "API key refused");
      }
      const membership = await membershipFor(
        transaction,
        record.userId,
        record.workspaceId
      );
      if (membership?.status !== "ACTIVE") {
        throw new IdentityOperationError(401, "api_key_refused", "API key refused");
      }
      if (
        !(record.lastUsedAt instanceof Date) ||
        now.getTime() - record.lastUsedAt.getTime() >=
          API_KEY_LAST_USED_WRITE_INTERVAL_MS
      ) {
        await transaction.apiKey.update({
          where: { id: record.id },
          data: { lastUsedAt: now },
        });
      }
      return {
        userId: record.userId,
        workspaceId: record.workspace.id,
        tenant: record.workspace.tenant,
        scopeRef: record.workspace.scopeRef,
        scopes: [...record.scopes],
      };
    });
  }

  async function adminOverview(principalInput, adminLogins = []) {
    const session = await reconcilePrincipal(principalInput);
    const now = nowDate(clock);
    // Provider login casing is part of the admitted tenant identity. The
    // operator allowlist is exact by policy and never case-folded.
    if (!adminLogins.includes(session.user.username)) {
      throw new IdentityOperationError(
        403,
        "admin_permission_refused",
        "Instance administration is not available to this identity"
      );
    }
    const [users, workspaces, invites] = await Promise.all([
      access.user.findMany({
        orderBy: { createdAt: "asc" },
        take: ADMIN_OVERVIEW_LIMIT + 1,
      }),
      access.workspace.findMany({
        orderBy: { createdAt: "asc" },
        take: ADMIN_OVERVIEW_LIMIT + 1,
      }),
      access.invite.findMany({
        where: { status: "PENDING", expiresAt: { gt: now } },
        include: { workspace: true, role: true },
        orderBy: { createdAt: "desc" },
        take: ADMIN_OVERVIEW_LIMIT + 1,
      }),
    ]);
    return {
      users: users.slice(0, ADMIN_OVERVIEW_LIMIT).map(publicUser),
      workspaces: workspaces.slice(0, ADMIN_OVERVIEW_LIMIT).map((workspace) => ({
        id: workspace.id,
        tenant: workspace.tenant,
        slug: workspace.slug,
        scopeRef: workspace.scopeRef,
        name: workspace.name,
      })),
      pendingInvites: invites
        .slice(0, ADMIN_OVERVIEW_LIMIT)
        .map((invite) => publicInvite(invite, { includeEmail: true })),
      truncated: {
        users: users.length > ADMIN_OVERVIEW_LIMIT,
        workspaces: workspaces.length > ADMIN_OVERVIEW_LIMIT,
        pendingInvites: invites.length > ADMIN_OVERVIEW_LIMIT,
      },
    };
  }

  return Object.freeze({
    acceptInvite: withDatabaseMapping(acceptInvite),
    adminOverview: withDatabaseMapping(adminOverview),
    authenticateApiKey: withDatabaseMapping(authenticateApiKey),
    createApiKey: withDatabaseMapping(createApiKey),
    createInvite: withDatabaseMapping(createInvite),
    createWorkspace: withDatabaseMapping(createWorkspace),
    inspectInvite: withDatabaseMapping(inspectInvite),
    listApiKeys: withDatabaseMapping(listApiKeys),
    listWorkspaces: withDatabaseMapping(listWorkspaces),
    reconcilePrincipal: withDatabaseMapping(reconcilePrincipal),
    resolveWorkspaceContentScope: withDatabaseMapping(
      resolveWorkspaceContentScope
    ),
    revokeApiKey: withDatabaseMapping(revokeApiKey),
    updateWorkspace: withDatabaseMapping(updateWorkspace),
  });
}

module.exports = {
  ADMIN_OVERVIEW_LIMIT,
  API_KEY_SCOPES,
  IdentityOperationError,
  createIdentityOperations,
  normalizePrincipal,
  normalizeWorkspaceSlug,
  tokenHash,
};
