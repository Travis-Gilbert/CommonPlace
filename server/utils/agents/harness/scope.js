"use strict";

const { harnessError } = require("./errors");

function normalizeAgentScope(value) {
  assertRecord(value, "Agent scope");

  const tenant = requiredText(value.tenant, "tenant");
  const principalId = requiredText(value.principalId, "principalId");
  const invocationId = requiredText(value.invocationId, "invocationId");
  const workspace = resolveRequiredEntity(value, "workspace", "workspaceId");
  const user = resolveOptionalEntity(value, "user", "userId");
  const thread = resolveOptionalEntity(value, "thread", "threadId");

  return Object.freeze({
    tenant,
    principalId,
    invocationId,
    workspace: workspace.entity,
    workspaceId: workspace.id,
    user: user.entity,
    userId: user.id,
    thread: thread.entity,
    threadId: thread.id,
  });
}

function workspaceScope(scope) {
  return Object.freeze({
    tenant: scope.tenant,
    principalId: scope.principalId,
    invocationId: scope.invocationId,
    workspace: scope.workspace,
    workspaceId: scope.workspaceId,
    user: null,
    userId: null,
    thread: null,
    threadId: null,
  });
}

function resolveRequiredEntity(value, entityKey, idKey) {
  const hasEntity = Object.prototype.hasOwnProperty.call(value, entityKey);
  const hasId = Object.prototype.hasOwnProperty.call(value, idKey);
  if (!hasEntity && !hasId) {
    throw harnessError(
      "HARNESS_SCOPE_INVALID",
      `Agent scope requires explicit ${entityKey} or ${idKey}.`
    );
  }

  const entity = hasEntity ? value[entityKey] : null;
  assertMatchingEntityId(entity, hasId ? value[idKey] : undefined, idKey);
  const id = entityId(entity, hasId ? value[idKey] : undefined);
  if (id === null) {
    throw harnessError(
      "HARNESS_SCOPE_INVALID",
      `Agent scope requires a non-empty ${idKey}.`
    );
  }

  return {
    entity: entity && typeof entity === "object" ? entity : Object.freeze({ id }),
    id,
  };
}

function resolveOptionalEntity(value, entityKey, idKey) {
  const hasEntity = Object.prototype.hasOwnProperty.call(value, entityKey);
  const hasId = Object.prototype.hasOwnProperty.call(value, idKey);
  if (!hasEntity && !hasId) {
    throw harnessError(
      "HARNESS_SCOPE_INVALID",
      `Agent scope requires explicit ${entityKey} or ${idKey}, including null.`
    );
  }

  const entity = hasEntity ? value[entityKey] : null;
  const explicitId = hasId ? value[idKey] : undefined;
  if (entity === null && (explicitId === undefined || explicitId === null)) {
    return { entity: null, id: null };
  }

  assertMatchingEntityId(entity, explicitId, idKey);
  const id = entityId(entity, explicitId);
  if (id === null) {
    throw harnessError(
      "HARNESS_SCOPE_INVALID",
      `Agent scope ${idKey} must be a non-empty string or finite number.`
    );
  }
  return {
    entity: entity && typeof entity === "object" ? entity : Object.freeze({ id }),
    id,
  };
}

function assertMatchingEntityId(entity, explicitId, idKey) {
  if (
    !entity ||
    typeof entity !== "object" ||
    explicitId === undefined ||
    explicitId === null ||
    entity.id === undefined ||
    entity.id === null
  ) {
    return;
  }
  if (String(entity.id) === String(explicitId)) return;
  throw harnessError(
    "HARNESS_SCOPE_INVALID",
    `Agent scope ${idKey} does not match the supplied entity.`
  );
}

function entityId(entity, explicitId) {
  const candidate =
    explicitId !== undefined
      ? explicitId
      : entity && typeof entity === "object"
        ? entity.id
        : entity;
  if (
    (typeof candidate === "string" && candidate.trim()) ||
    (typeof candidate === "number" && Number.isFinite(candidate))
  ) {
    return candidate;
  }
  return null;
}

function requiredText(value, name) {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw harnessError(
    "HARNESS_SCOPE_INVALID",
    `Agent scope requires a non-empty ${name}.`
  );
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw harnessError("HARNESS_SCOPE_INVALID", `${label} must be an object.`);
  }
}

module.exports = { normalizeAgentScope, workspaceScope };
