"use strict";

const { createHash } = require("node:crypto");

const { harnessError } = require("./errors");
const {
  admittedIdentity,
  assertNoNestedIdentity,
} = require("./mcp-client");
const { normalizeAgentScope } = require("./scope");

const MODEL_TOOL_NAMES = Object.freeze(["catalog", "describe", "invoke"]);
const MODEL_TOOL_IDS = Object.freeze([
  "@@mcp_catalog",
  "@@mcp_describe",
  "@@mcp_invoke",
]);
const MODEL_TOOL_DEFINITIONS = deepFreeze([
  {
    id: "@@mcp_catalog",
    name: "catalog",
    description:
      "Search the admitted Harness capability catalog. Results are compact and paginated.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        pageSize: { type: "integer", minimum: 1, maximum: 20 },
        cursor: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    id: "@@mcp_describe",
    name: "describe",
    description:
      "Describe the input and output contract for one admitted Harness capability.",
    inputSchema: {
      type: "object",
      properties: {
        capabilityId: { type: "string" },
      },
      required: ["capabilityId"],
      additionalProperties: false,
    },
  },
  {
    id: "@@mcp_invoke",
    name: "invoke",
    description:
      "Invoke one freshly described and admitted Harness capability.",
    inputSchema: {
      type: "object",
      properties: {
        capabilityId: { type: "string" },
        arguments: { type: "object" },
        taskType: { type: "string" },
        dryRun: { type: "boolean" },
      },
      required: ["capabilityId", "arguments"],
      additionalProperties: false,
    },
  },
]);

class HarnessToolSurface {
  #client;
  #policy;
  #maxPageSize;
  #maxWindow;

  constructor({
    client,
    policy,
    maxPageSize = 10,
    maxWindow = 100,
  } = {}) {
    if (!client || typeof client.callTool !== "function") {
      throw harnessError(
        "HARNESS_CONFIGURATION_INVALID",
        "Harness tool surface requires an MCP client."
      );
    }
    if (!policy || typeof policy.authorize !== "function") {
      throw harnessError(
        "HARNESS_CONFIGURATION_INVALID",
        "Harness tool surface requires an explicit capability policy."
      );
    }
    if (
      !Number.isSafeInteger(maxPageSize) ||
      maxPageSize < 1 ||
      maxPageSize > 20 ||
      !Number.isSafeInteger(maxWindow) ||
      maxWindow < maxPageSize ||
      maxWindow > 100
    ) {
      throw harnessError(
        "HARNESS_CONFIGURATION_INVALID",
        "Harness catalog bounds are invalid."
      );
    }
    this.#client = client;
    this.#policy = policy;
    this.#maxPageSize = maxPageSize;
    this.#maxWindow = maxWindow;
  }

  definitions() {
    return MODEL_TOOL_DEFINITIONS;
  }

  async execute(name, argumentsValue, scopeValue, executionValue) {
    const operation = logicalToolName(name);
    if (!operation) {
      throw harnessError(
        "HARNESS_TOOL_SURFACE_VIOLATION",
        `Model-visible tool '${String(name)}' is not admitted.`
      );
    }
    const scope = normalizeAgentScope(scopeValue);
    const argumentsRecord = record(argumentsValue) ?? {};
    if (operation === "catalog") {
      return this.#catalog(argumentsRecord, scope);
    }
    if (operation === "describe") {
      return this.#describe(argumentsRecord, scope);
    }
    return this.#invoke(argumentsRecord, scope, executionValue);
  }

  async #catalog(argumentsValue, scope) {
    const query = optionalText(argumentsValue.query) ?? "general";
    const pageSize = boundedPageSize(
      argumentsValue.pageSize,
      this.#maxPageSize
    );
    let rawOffset = decodeCursor(argumentsValue.cursor, query);
    if (rawOffset >= this.#maxWindow) {
      throw harnessError(
        "HARNESS_CATALOG_CURSOR_INVALID",
        "Harness catalog cursor exceeds the bounded search window."
      );
    }

    const response = await this.#client.callTool({
      name: "tool_search",
      arguments: { query, k: this.#maxWindow },
      scope,
    });
    const rawResults = Array.isArray(response.results) ? response.results : [];
    const page = [];
    while (rawOffset < rawResults.length && page.length < pageSize) {
      const rawResult = rawResults[rawOffset];
      rawOffset += 1;
      const capability = compactCapability(rawResult);
      if (!capability) continue;
      if (
        await this.#authorized({
          operation: "catalog",
          scope,
          capability,
        })
      ) {
        page.push(capability);
      }
    }

    const hasMore = rawOffset < rawResults.length;

    return {
      query,
      results: page,
      page: {
        size: page.length,
        cursor: argumentsValue.cursor ?? null,
        nextCursor:
          hasMore && page.length > 0
            ? encodeCursor(rawOffset, query)
            : null,
        boundedWindow: this.#maxWindow,
      },
    };
  }

  async #describe(argumentsValue, scope) {
    const capabilityId = requiredCapabilityId(argumentsValue);
    await this.#assertAuthorized({
      operation: "describe",
      scope,
      capability: { id: capabilityId },
    });

    const response = await this.#client.callTool({
      name: "describe",
      arguments: { affordance_id: capabilityId },
      scope,
    });
    const capability = describedCapability(response, capabilityId);
    await this.#assertAuthorized({
      operation: "describe",
      scope,
      capability,
    });
    return capability;
  }

  async #invoke(argumentsValue, scope, executionValue) {
    const capabilityId = requiredCapabilityId(argumentsValue);
    const toolArguments = record(argumentsValue.arguments);
    if (!toolArguments) {
      throw harnessError(
        "HARNESS_TOOL_ARGUMENTS_INVALID",
        "invoke.arguments must be an object."
      );
    }
    assertNoNestedIdentity(toolArguments);
    const toolCallId = requiredToolCallId(executionValue);
    await this.#assertAuthorized({
      operation: "invoke",
      scope,
      capability: { id: capabilityId },
    });

    const described = await this.#client.callTool({
      name: "describe",
      arguments: { affordance_id: capabilityId },
      scope,
    });
    const capability = describedCapability(described, capabilityId);
    await this.#assertAuthorized({
      operation: "invoke",
      scope,
      capability,
    });

    const response = await this.#client.callTool({
      name: "invoke",
      arguments: {
        affordance_id: capabilityId,
        arguments: toolArguments,
        task_type: optionalText(argumentsValue.taskType) ?? "commonplace-chat",
        candidate_affordance_ids: [capabilityId],
        dry_run: argumentsValue.dryRun === true,
        idempotency_key: invocationIdempotencyKey(
          scope,
          toolCallId,
          capabilityId,
          toolArguments
        ),
      },
      scope,
    });
    const identity = responseIdentity(response, scope);
    const planned = record(response.planned) ?? {};
    const provenance = Object.freeze({
      tenant: identity.tenant,
      principal: identity.principal ?? null,
      bindingId: identity.bindingId ?? null,
      actor: identity.actor ?? null,
      authenticated: identity.authenticated === true,
      capabilityId,
      serverId:
        optionalText(planned.server_id) ??
        optionalText(capability.serverId) ??
        null,
      toolName:
        optionalText(planned.tool_name) ??
        optionalText(capability.toolName) ??
        null,
    });
    return {
      result: response,
      provenance,
      receipt: invocationReceipt(response),
    };
  }

  async #authorized(request) {
    try {
      const decision = await this.#policy.authorize(request);
      return decision === true || record(decision)?.allowed === true;
    } catch (error) {
      throw harnessError(
        "HARNESS_POLICY_UNAVAILABLE",
        "Harness capability policy could not authorize the operation.",
        { cause: error }
      );
    }
  }

  async #assertAuthorized(request) {
    if (await this.#authorized(request)) return;
    throw harnessError(
      "HARNESS_CAPABILITY_SUPPRESSED",
      `Harness capability '${request.capability.id}' is suppressed for ${request.operation}.`
    );
  }
}

function responseIdentity(response, scope) {
  const admitted = admittedIdentity(response);
  const receipt = record(response)?.identity_receipt;
  const receiptTenant = optionalText(receipt?.tenant);
  const tenant = admitted?.tenant ?? receiptTenant;
  if (tenant !== scope.tenant) {
    throw harnessError(
      "HARNESS_IDENTITY_RECEIPT_MISMATCH",
      "Harness invocation result did not retain the admitted tenant."
    );
  }
  return (
    admitted ??
    Object.freeze({
      tenant,
      principal: optionalText(receipt?.principal),
      bindingId: optionalText(receipt?.binding_id),
      actor: optionalText(receipt?.actor),
      authenticated: Boolean(receipt),
    })
  );
}

function compactCapability(value) {
  const source = record(value);
  if (!source) return null;
  const id = firstText(source.affordance_id, source.affordanceId, source.id);
  if (!id) return null;
  return removeUndefined({
    id,
    serverId: firstText(source.server_id, source.serverId),
    toolName: firstText(source.tool_name, source.toolName),
    name: firstText(source.name, source.label),
    description: firstText(
      source.description,
      source.one_line_description,
      source.oneLineDescription
    ),
    family: firstText(source.family),
    tags: stringArray(source.tags),
    fitness: typeof source.fitness === "number" ? source.fitness : undefined,
    writebackPolicy: source.writeback_policy ?? source.writebackPolicy,
  });
}

function describedCapability(value, expectedId) {
  const source = record(value);
  if (!source) {
    throw harnessError(
      "HARNESS_MCP_INVALID_RESULT",
      "Harness describe returned no capability contract."
    );
  }
  const id = firstText(
    source.affordance_id,
    source.affordanceId,
    source.id,
    expectedId
  );
  if (id !== expectedId) {
    throw harnessError(
      "HARNESS_CAPABILITY_IDENTITY_MISMATCH",
      "Harness describe returned a different capability identity."
    );
  }
  return removeUndefined({
    id,
    serverId: firstText(source.server_id, source.serverId),
    toolName: firstText(source.tool_name, source.toolName),
    name: firstText(source.name, source.label),
    description: firstText(source.description),
    inputSchema: cloneJson(source.input_schema ?? source.inputSchema ?? {}),
    outputSchema: cloneJson(source.output_schema ?? source.outputSchema ?? {}),
    permissions: stringArray(source.permissions),
    tags: stringArray(source.tags),
    annotations: cloneJson(source.annotations ?? {}),
    writebackPolicy: cloneJson(
      source.writeback_policy ?? source.writebackPolicy ?? null
    ),
  });
}

function invocationReceipt(response) {
  return cloneJson({
    recorded: response.recorded ?? null,
    operationReceipt: response.operation_receipt ?? null,
    operationReceipts: Array.isArray(response.operation_receipts)
      ? response.operation_receipts
      : [],
    fired: response.fired === true,
    dryRun: response.dry_run === true,
  });
}

function invocationIdempotencyKey(
  scope,
  toolCallId,
  capabilityId,
  toolArguments
) {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        invocationId: scope.invocationId,
        toolCallId,
        capabilityId,
        toolArguments: stableJson(toolArguments),
      })
    )
    .digest("hex")
    .slice(0, 24);
  return `${scope.invocationId}:${digest}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  const source = record(value);
  if (!source) return value;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, stableJson(source[key])])
  );
}

function logicalToolName(name) {
  if (MODEL_TOOL_NAMES.includes(name)) return name;
  const index = MODEL_TOOL_IDS.indexOf(name);
  return index >= 0 ? MODEL_TOOL_NAMES[index] : null;
}

function requiredCapabilityId(argumentsValue) {
  const id = firstText(
    argumentsValue.capabilityId,
    argumentsValue.affordanceId,
    argumentsValue.affordance_id
  );
  if (!id) {
    throw harnessError(
      "HARNESS_TOOL_ARGUMENTS_INVALID",
      "A non-empty capabilityId is required."
    );
  }
  return id;
}

function requiredToolCallId(executionValue) {
  const toolCallId = optionalText(record(executionValue)?.toolCallId);
  if (!toolCallId) {
    throw harnessError(
      "HARNESS_TOOL_CALL_ID_INVALID",
      "Harness invoke requires an immutable logical tool-call ID."
    );
  }
  return toolCallId;
}

function boundedPageSize(value, maximum) {
  if (value === undefined || value === null) return maximum;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw harnessError(
      "HARNESS_TOOL_ARGUMENTS_INVALID",
      `catalog.pageSize must be between 1 and ${maximum}.`
    );
  }
  return value;
}

function encodeCursor(offset, query) {
  return Buffer.from(JSON.stringify({ version: 1, offset, query })).toString(
    "base64url"
  );
}

function decodeCursor(cursor, query) {
  if (cursor === undefined || cursor === null || cursor === "") return 0;
  if (typeof cursor !== "string") {
    throw harnessError(
      "HARNESS_CATALOG_CURSOR_INVALID",
      "Harness catalog cursor must be a string."
    );
  }
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (
      payload.version !== 1 ||
      payload.query !== query ||
      !Number.isSafeInteger(payload.offset) ||
      payload.offset < 0
    ) {
      throw new Error("invalid cursor");
    }
    return payload.offset;
  } catch {
    throw harnessError(
      "HARNESS_CATALOG_CURSOR_INVALID",
      "Harness catalog cursor is invalid for this query."
    );
  }
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstText(...values) {
  for (const value of values) {
    const text = optionalText(value);
    if (text) return text;
  }
  return null;
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string")
    : [];
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

module.exports = {
  HarnessToolSurface,
  MODEL_TOOL_DEFINITIONS,
  MODEL_TOOL_IDS,
  MODEL_TOOL_NAMES,
  compactCapability,
  describedCapability,
};
