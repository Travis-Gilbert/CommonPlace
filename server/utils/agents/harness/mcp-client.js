"use strict";

const { harnessError } = require("./errors");
const { normalizeAgentScope } = require("./scope");

const ALLOWED_UPSTREAM_TOOLS = Object.freeze([
  "tool_search",
  "describe",
  "invoke",
  "tool_result_fetch",
]);
const MCP_SSE_MAX_BUFFER_BYTES = 1024 * 1024;
// Current Theorem defaults ordinary tool results, including continuation
// envelopes, to 16 KiB. A quote-heavy string can double after JSON escaping,
// so keep the decoded chunk at 4 KiB and leave room for envelope metadata.
const MCP_FETCH_CHUNK_BYTES = 4 * 1024;
const MCP_FETCH_MAX_BYTES = 1024 * 1024;
const MCP_FETCH_MAX_CHUNKS = 256;
const ADMITTED_IDENTITY = Symbol("commonplace.harness.admittedIdentity");
const RESERVED_IDENTITY_KEYS = new Set([
  "tenant",
  "tenant_id",
  "tenantId",
  "tenant_slug",
  "tenantSlug",
  "principal",
  "principal_id",
  "principalId",
  "actor",
  "actor_id",
  "actorId",
  "workspace_id",
  "workspaceId",
  "project_id",
  "projectId",
  "project_slug",
  "projectSlug",
  "selected_project_id",
  "selectedProjectId",
  "selected_project_slug",
  "selectedProjectSlug",
  "binding_id",
  "bindingId",
  "session_id",
  "sessionId",
  "user_id",
  "userId",
  "thread_id",
  "threadId",
  "invocation_id",
  "invocationId",
]);

class HarnessMcpClient {
  #config;
  #fetch;
  #requestSequence = 0;

  constructor({ config, fetchImpl = globalThis.fetch } = {}) {
    if (!config || typeof config !== "object") {
      throw harnessError(
        "HARNESS_CONFIGURATION_INVALID",
        "Harness MCP client requires resolved configuration."
      );
    }
    if (typeof fetchImpl !== "function") {
      throw harnessError(
        "HARNESS_CONFIGURATION_INVALID",
        "Harness MCP client requires a fetch implementation."
      );
    }
    this.#config = config;
    this.#fetch = fetchImpl;
  }

  async callTool({ name, arguments: argumentsValue = {}, scope: scopeValue }) {
    if (!ALLOWED_UPSTREAM_TOOLS.includes(name)) {
      throw harnessError(
        "HARNESS_TOOL_SURFACE_VIOLATION",
        `Harness MCP client refuses upstream tool '${String(name)}'.`
      );
    }

    const scope = normalizeAgentScope(scopeValue);
    if (!this.#config.allowedTenants.includes(scope.tenant)) {
      throw harnessError(
        "HARNESS_TENANT_NOT_ADMITTED",
        `Tenant '${scope.tenant}' is not admitted by Harness configuration.`
      );
    }
    if (
      this.#config.token &&
      this.#config.tokenTenant !== scope.tenant
    ) {
      throw harnessError(
        "HARNESS_TOKEN_TENANT_MISMATCH",
        `Harness bearer token is bound to '${String(
          this.#config.tokenTenant
        )}', not '${scope.tenant}'.`
      );
    }
    if (!isRecord(argumentsValue)) {
      throw harnessError(
        "HARNESS_TOOL_ARGUMENTS_INVALID",
        "Harness tool arguments must be an object."
      );
    }
    if (name === "invoke") {
      assertNoNestedIdentity(record(argumentsValue.arguments) ?? {});
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.#config.timeoutMs);

    try {
      const result = await this.#postTool({
        name,
        argumentsValue,
        scope,
        signal: abortController.signal,
      });
      return this.#resolveTruncatedResult(result, scope, abortController.signal);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw harnessError(
          "HARNESS_MCP_TIMEOUT",
          "Harness MCP request timed out.",
          {
            cause: error,
            details: {
              retrySafe: false,
              completionState: "unknown",
            },
          }
        );
      }
      if (error?.code) throw withUnknownCompletion(error);
      throw harnessError(
        "HARNESS_MCP_UNREACHABLE",
        "Harness MCP endpoint was unreachable.",
        {
          cause: error,
          details: {
            retrySafe: false,
            completionState: "unknown",
          },
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async #postTool({ name, argumentsValue, scope, signal }) {
    const requestId = this.#requestId(name);
    const response = await this.#fetch(this.#config.endpoint, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name,
          arguments: bindScope(argumentsValue, scope),
        },
      }),
      cache: "no-store",
      signal,
    });
    const payload = await readMcpPayload(response, requestId);
    const rpcError = record(payload?.error);
    if (rpcError) {
      throw harnessError(
        "HARNESS_TOOL_REFUSED",
        typeof rpcError.message === "string"
          ? rpcError.message
          : "Harness tool call was refused.",
        {
          details: rpcErrorDetails(rpcError, response.status),
        }
      );
    }
    if (!response.ok) {
      throw harnessError(
        "HARNESS_MCP_REQUEST_FAILED",
        `Harness MCP request failed with status ${response.status}.`,
        {
          details: {
            httpStatus: response.status,
            retrySafe: false,
            completionState: "unknown",
          },
        }
      );
    }
    if (!payload) {
      throw harnessError(
        "HARNESS_MCP_INVALID_RESULT",
        "Harness MCP returned no matching JSON-RPC response."
      );
    }
    const result = normalizeToolResult(payload.result);
    if (!(result.truncated === true && typeof result.fetch_handle === "string")) {
      return this.#admitResult(result, scope);
    }
    return result;
  }

  #admitResult(result, scope) {
    if (!this.#config.token) {
      return attachAdmittedIdentity(result, {
        tenant: scope.tenant,
        principal: null,
        bindingId: null,
        actor: null,
        authenticated: false,
      });
    }
    const receipt = record(result.identity_receipt);
    const admitted = {
      tenant: text(receipt?.tenant),
      principal: text(receipt?.principal),
      bindingId: text(receipt?.binding_id),
      actor: text(receipt?.actor),
    };
    const expected = {
      tenant: scope.tenant,
      principal: this.#config.tokenPrincipal,
      bindingId: this.#config.tokenBinding,
      actor: this.#config.tokenActor,
    };
    if (
      !receipt ||
      admitted.tenant !== expected.tenant ||
      admitted.principal !== expected.principal ||
      admitted.bindingId !== expected.bindingId ||
      admitted.actor !== expected.actor
    ) {
      throw harnessError(
        "HARNESS_IDENTITY_RECEIPT_MISMATCH",
        "Harness MCP response did not prove the bearer token's exact admitted identity.",
        {
          details: {
            expected,
            admitted,
          },
        }
      );
    }
    return attachAdmittedIdentity(result, {
      ...admitted,
      authenticated: true,
    });
  }

  async #resolveTruncatedResult(result, scope, signal) {
    const handle =
      result?.truncated === true && typeof result.fetch_handle === "string"
        ? result.fetch_handle.trim()
        : "";
    if (!handle) return result;

    let offset = 0;
    let assembled = "";
    for (let chunkIndex = 0; chunkIndex < MCP_FETCH_MAX_CHUNKS; chunkIndex += 1) {
      const chunk = await this.#postTool({
        name: "tool_result_fetch",
        argumentsValue: {
          fetch_handle: handle,
          offset,
          max_bytes: MCP_FETCH_CHUNK_BYTES,
        },
        scope,
        signal,
      });
      if (
        chunk.fetch_handle !== handle ||
        chunk.offset !== offset ||
        typeof chunk.text !== "string"
      ) {
        throw harnessError(
          "HARNESS_MCP_INVALID_RESULT",
          "Harness tool-result continuation changed identity or offset."
        );
      }
      assembled += chunk.text;
      if (Buffer.byteLength(assembled) > MCP_FETCH_MAX_BYTES) {
        throw harnessError(
          "HARNESS_MCP_RESPONSE_TOO_LARGE",
          "Harness tool-result continuation exceeded the bridge buffer limit."
        );
      }
      if (chunk.next_offset === null || chunk.next_offset === undefined) {
        const parsed = parseRecord(assembled);
        if (!parsed) {
          throw harnessError(
            "HARNESS_MCP_INVALID_RESULT",
            "Harness tool-result continuation did not reconstruct JSON."
          );
        }
        return this.#admitResult(parsed, scope);
      }
      if (
        !Number.isSafeInteger(chunk.next_offset) ||
        chunk.next_offset <= offset
      ) {
        throw harnessError(
          "HARNESS_MCP_INVALID_RESULT",
          "Harness tool-result continuation did not advance."
        );
      }
      offset = chunk.next_offset;
    }
    throw harnessError(
      "HARNESS_MCP_RESPONSE_TOO_LARGE",
      "Harness tool-result continuation exceeded the chunk limit."
    );
  }

  #headers() {
    return {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": this.#config.protocolVersion,
      ...(this.#config.token
        ? { Authorization: `Bearer ${this.#config.token}` }
        : {}),
    };
  }

  #requestId(prefix) {
    this.#requestSequence += 1;
    return `${prefix}-${this.#requestSequence}`;
  }
}

function bindScope(argumentsValue, scope) {
  return {
    ...argumentsValue,
    tenant: scope.tenant,
    principal_id: scope.principalId,
    actor: scope.principalId,
    workspace_id: scope.workspaceId,
    user_id: scope.userId,
    thread_id: scope.threadId,
    invocation_id: scope.invocationId,
  };
}

function admittedIdentity(value) {
  const source = record(value);
  return source ? source[ADMITTED_IDENTITY] ?? null : null;
}

function attachAdmittedIdentity(result, identity) {
  Object.defineProperty(result, ADMITTED_IDENTITY, {
    configurable: false,
    enumerable: false,
    value: Object.freeze(identity),
    writable: false,
  });
  return result;
}

function assertNoNestedIdentity(value, path = "arguments") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoNestedIdentity(entry, `${path}[${index}]`)
    );
    return;
  }
  const source = record(value);
  if (!source) return;
  for (const [key, entry] of Object.entries(source)) {
    if (RESERVED_IDENTITY_KEYS.has(key)) {
      throw harnessError(
        "HARNESS_TOOL_IDENTITY_OVERRIDE",
        `Harness invoke refuses identity field '${path}.${key}'.`
      );
    }
    assertNoNestedIdentity(entry, `${path}.${key}`);
  }
}

async function readMcpPayload(response, expectedId) {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await readResponseText(response);
  if (contentType.includes("application/json")) {
    const payload = parseRecord(body);
    return payload?.id === expectedId ? payload : null;
  }

  for (const event of parseServerSentEvents(body)) {
    const payload = parseRecord(event);
    if (payload?.id === expectedId) return payload;
  }
  return null;
}

async function readResponseText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        body += decoder.decode();
        return body;
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MCP_SSE_MAX_BUFFER_BYTES) {
        throw harnessError(
          "HARNESS_MCP_RESPONSE_TOO_LARGE",
          "Harness MCP response exceeded the bridge buffer limit."
        );
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function parseServerSentEvents(body) {
  const events = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) events.push(data);
  }
  return events;
}

function normalizeToolResult(value) {
  const result = record(value);
  if (!result) {
    throw harnessError(
      "HARNESS_MCP_INVALID_RESULT",
      "Harness MCP returned no tool result."
    );
  }
  if (result.isError === true) {
    const errorDetails = toolErrorDetails(result);
    throw harnessError(
      "HARNESS_TOOL_REFUSED",
      errorDetails.message ?? "Harness tool call was refused.",
      { details: errorDetails.details }
    );
  }

  const structured = record(result.structuredContent);
  if (structured && Object.keys(structured).length > 0) return structured;

  const content = Array.isArray(result.content) ? result.content : [];
  for (const entry of content) {
    const text = record(entry)?.text;
    if (typeof text !== "string") continue;
    const parsed = parseRecord(text);
    if (parsed) return parsed;
  }
  throw harnessError(
    "HARNESS_MCP_INVALID_RESULT",
    "Harness MCP tool result did not contain structured JSON."
  );
}

function toolErrorMessage(result) {
  const content = Array.isArray(result.content) ? result.content : [];
  for (const entry of content) {
    const text = record(entry)?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return null;
}

function toolErrorDetails(result) {
  const structured = record(result.structuredContent);
  const contentError = parsedToolError(result);
  const structuredError =
    record(structured?.error) ??
    (structured &&
    (typeof structured.code === "string" ||
      typeof structured.error === "string")
      ? structured
      : null) ??
    contentError;
  const message =
    (typeof structuredError?.message === "string"
      ? structuredError.message.trim()
      : "") ||
    toolErrorMessage(result);
  return {
    message: message || null,
    details: structuredError
      ? {
          code: structuredError.code ?? structuredError.error ?? null,
          data: cloneJson(structuredError.data ?? structuredError),
          retrySafe:
            structuredError.retry_safe ??
            structuredError.retrySafe ??
            false,
          completionState:
            structuredError.completion_state ??
            structuredError.completionState ??
            "unknown",
        }
      : {
          retrySafe: false,
          completionState: "unknown",
        },
  };
}

function parsedToolError(result) {
  const content = Array.isArray(result.content) ? result.content : [];
  for (const entry of content) {
    const text = record(entry)?.text;
    if (typeof text !== "string") continue;
    const parsed = parseRecord(text);
    if (
      parsed &&
      (typeof parsed.code === "string" ||
        typeof parsed.error === "string" ||
        typeof parsed.message === "string")
    ) {
      return parsed;
    }
  }
  return null;
}

function rpcErrorDetails(error, httpStatus) {
  const data = record(error.data);
  return {
    rpcCode:
      typeof error.code === "number" || typeof error.code === "string"
        ? error.code
        : null,
    rpcData: cloneJson(error.data ?? null),
    httpStatus,
    retrySafe: data?.retry_safe ?? data?.retrySafe ?? false,
    completionState:
      data?.completion_state ?? data?.completionState ?? "unknown",
  };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function parseRecord(text) {
  try {
    return record(JSON.parse(text));
  } catch {
    return null;
  }
}

function isRecord(value) {
  return Boolean(record(value));
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function withUnknownCompletion(error) {
  const details = record(error?.details) ?? {};
  if (
    typeof details.retrySafe === "boolean" &&
    typeof details.completionState === "string"
  ) {
    return error;
  }
  return harnessError(error.code, error.message, {
    cause: error,
    details: {
      ...cloneJson(details),
      retrySafe: false,
      completionState: "unknown",
    },
  });
}

module.exports = {
  ALLOWED_UPSTREAM_TOOLS,
  HarnessMcpClient,
  admittedIdentity,
  assertNoNestedIdentity,
  bindScope,
  normalizeToolResult,
  parseServerSentEvents,
};
