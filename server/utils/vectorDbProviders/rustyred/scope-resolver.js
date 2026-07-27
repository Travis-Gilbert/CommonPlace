"use strict";

const { ContentTransportError, assertScope } = require("./content-transport");

function createEnvironmentScopeResolver(
  rawScopeMap = process.env.COMMONPLACE_WORKSPACE_SCOPE_MAP
) {
  if (!rawScopeMap) {
    throw new ContentTransportError(
      "COMMONPLACE_WORKSPACE_SCOPE_MAP is required. Namespace values are never trusted as tenant scopes.",
      { code: "CONTENT_SCOPE_MAP_MISSING" }
    );
  }

  let scopeMap;
  try {
    scopeMap = JSON.parse(rawScopeMap);
  } catch {
    throw new ContentTransportError(
      "COMMONPLACE_WORKSPACE_SCOPE_MAP must be valid JSON.",
      { code: "CONTENT_SCOPE_MAP_INVALID" }
    );
  }

  return async function resolveWorkspaceScope(namespace) {
    if (typeof namespace !== "string" || namespace.trim().length === 0) {
      throw new ContentTransportError("A workspace namespace is required.", {
        code: "CONTENT_NAMESPACE_MISSING",
      });
    }

    const scope = scopeMap[namespace];
    if (!scope) {
      throw new ContentTransportError(
        `No admitted graph scope exists for workspace namespace ${namespace}.`,
        {
          code: "CONTENT_SCOPE_NOT_ADMITTED",
          details: { namespace },
        }
      );
    }

    assertScope(scope);
    return Object.freeze({
      tenant: scope.tenant,
      workspaceId: scope.workspaceId,
      scopeRef: scope.scopeRef,
    });
  };
}

module.exports = { createEnvironmentScopeResolver };
