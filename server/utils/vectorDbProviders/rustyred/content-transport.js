"use strict";

const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

class ContentTransportError extends Error {
  constructor(
    message,
    {
      code = "CONTENT_TRANSPORT_ERROR",
      retryable = false,
      status = null,
      details = null,
    } = {}
  ) {
    super(message);
    this.name = "ContentTransportError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.details = details;
  }
}

class UnsupportedContentOperationError extends ContentTransportError {
  constructor(operation) {
    super(
      `The configured CommonPlace content transport does not support ${operation}.`,
      { code: "UNSUPPORTED_CONTENT_OPERATION", details: { operation } }
    );
    this.name = "UnsupportedContentOperationError";
  }
}

class ContentTransport {
  async heartbeat() {
    throw new UnsupportedContentOperationError("heartbeat");
  }

  async count(_scope) {
    throw new UnsupportedContentOperationError("count");
  }

  async ingest(_scope, _document) {
    throw new UnsupportedContentOperationError("ingest");
  }

  async retrieve(_scope, _request) {
    throw new UnsupportedContentOperationError("retrieve");
  }

  async deleteDocument(_scope, _documentId) {
    throw new UnsupportedContentOperationError("deleteDocument");
  }

  async deleteNamespace(_scope) {
    throw new UnsupportedContentOperationError("deleteNamespace");
  }

  async reset() {
    throw new UnsupportedContentOperationError("reset");
  }
}

class CommonplaceGraphqlTransport extends ContentTransport {
  #apiKey;
  #endpoint;
  #fetch;
  #maxResponseBytes;
  #timeoutMs;
  #unsafeAllowUnscopedScopeFallback;

  constructor({
    endpoint,
    apiKey,
    fetchImpl = globalThis.fetch,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs = 30_000,
    unsafeAllowUnscopedScopeFallback = false,
  }) {
    super();
    if (!endpoint) {
      throw new ContentTransportError(
        "COMMONPLACE_CONTENT_GRAPHQL_URL is required for the GraphQL content transport.",
        { code: "CONTENT_ENDPOINT_MISSING" }
      );
    }
    if (!apiKey) {
      throw new ContentTransportError(
        "COMMONPLACE_CONTENT_API_KEY is required for the GraphQL content transport.",
        { code: "CONTENT_API_KEY_MISSING" }
      );
    }
    if (typeof fetchImpl !== "function") {
      throw new ContentTransportError("A fetch implementation is required.", {
        code: "FETCH_MISSING",
      });
    }
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
      throw new ContentTransportError(
        "CommonPlace response limit must be a positive safe integer.",
        { code: "CONTENT_RESPONSE_LIMIT_INVALID" }
      );
    }

    this.#endpoint = endpoint;
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
    this.#maxResponseBytes = maxResponseBytes;
    this.#timeoutMs = timeoutMs;
    this.#unsafeAllowUnscopedScopeFallback = unsafeAllowUnscopedScopeFallback;
  }

  async heartbeat() {
    await this.#request({
      query: "query ContentHeartbeat { __typename }",
      variables: {},
      scope: null,
    });
    return { heartbeat: Date.now() };
  }

  async count(scope) {
    this.#assertScopedOperation("count", scope);
    const data = await this.#request({
      query: `
        query ContentCount {
          itemCount
        }
      `,
      variables: {},
      scope,
    });
    return requireFiniteNumber(data.itemCount, "itemCount");
  }

  async ingest(scope, document) {
    this.#assertScopedOperation("ingest", scope);
    const data = await this.#request({
      query: `
        mutation IngestDocument($input: IngestInputGql!) {
          ingest(input: $input) {
            id
            title
            source
            classification
            collections
            path
          }
        }
      `,
      variables: {
        input: {
          title: document.title,
          text: document.text,
          kind: document.kind,
          tags: document.tags,
          source: document.source,
          sourceRef: document.sourceRef,
        },
      },
      scope,
    });
    return requireObject(data.ingest, "ingest");
  }

  async retrieve(scope, { input, topN }) {
    this.#assertScopedOperation("retrieve", scope);
    const data = await this.#request({
      query: `
        query RetrieveGrounding($question: String!, $k: Int!) {
          ask(question: $question, k: $k) {
            provenance {
              score
              arms
              item {
                id
                title
                bodyText
                source
                classification
                collections
                path
              }
            }
            pprExpansion {
              seedCount
              flatCandidateCount
              pprCandidateCount
              pprOnlyCandidateCount
            }
          }
        }
      `,
      variables: { question: input, k: topN },
      scope,
    });
    return requireObject(data.ask, "ask");
  }

  async #request({ query, variables, scope }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": this.#apiKey,
    };
    if (scope) {
      assertScope(scope);
      headers["x-commonplace-scope-ref"] = scope.scopeRef;
      headers["x-commonplace-tenant"] = scope.tenant;
      headers["x-commonplace-workspace"] = scope.workspaceId;
    }

    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ContentTransportError(
          `CommonPlace GraphQL returned HTTP ${response.status}.`,
          {
            code: "CONTENT_HTTP_ERROR",
            retryable: response.status >= 500,
            status: response.status,
            details: { status: response.status },
          }
        );
      }

      const payload = await readJsonResponse(response, this.#maxResponseBytes);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new ContentTransportError("CommonPlace GraphQL returned a malformed payload.", {
          code: "CONTENT_RESPONSE_INVALID",
        });
      }
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        throw new ContentTransportError("CommonPlace GraphQL refused the request.", {
          code: "CONTENT_GRAPHQL_ERROR",
          details: {
            messages: payload.errors.map((error) => error.message),
          },
        });
      }
      if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
        throw new ContentTransportError("CommonPlace GraphQL returned no data.", {
          code: "CONTENT_RESPONSE_INVALID",
        });
      }
      return payload.data;
    } catch (error) {
      if (error instanceof ContentTransportError) {
        throw error;
      }
      if (error?.name === "AbortError") {
        throw new ContentTransportError("CommonPlace GraphQL request timed out.", {
          code: "CONTENT_TIMEOUT",
        });
      }
      throw new ContentTransportError("CommonPlace GraphQL request failed.", {
        code: "CONTENT_NETWORK_ERROR",
        details: { cause: error?.message ?? String(error) },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  #assertScopedOperation(operation, scope) {
    assertScope(scope);
    if (this.#unsafeAllowUnscopedScopeFallback) {
      return;
    }

    throw new ContentTransportError(
      `CommonPlace GraphQL does not yet enforce admitted scope headers for ${operation}; refusing the unsafe fallback.`,
      {
        code: "CONTENT_SCOPE_ENFORCEMENT_MISSING",
        details: {
          operation,
          requiredEnv: "COMMONPLACE_UNSAFE_ALLOW_UNSCOPED_GRAPHQL=1",
        },
      }
    );
  }
}

async function readJsonResponse(response, maxResponseBytes) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await response.body?.cancel?.().catch(() => undefined);
    throw responseTooLargeError();
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    throw new ContentTransportError(
      "CommonPlace GraphQL returned an unreadable response body.",
      { code: "CONTENT_HTTP_RESPONSE_INVALID", status: 502 }
    );
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxResponseBytes) {
        throw responseTooLargeError();
      }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return parseJsonPayload(Buffer.concat(chunks, totalBytes).toString("utf8"));
}

function parseJsonPayload(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new ContentTransportError(
      "CommonPlace GraphQL returned invalid JSON.",
      { code: "CONTENT_RESPONSE_INVALID", status: 502 }
    );
  }
}

function responseTooLargeError() {
  return new ContentTransportError(
    "CommonPlace GraphQL response exceeded the configured limit.",
    { code: "CONTENT_RESPONSE_TOO_LARGE", status: 502 }
  );
}

function assertScope(scope) {
  for (const key of ["tenant", "workspaceId", "scopeRef"]) {
    if (typeof scope?.[key] !== "string" || scope[key].trim().length === 0) {
      throw new ContentTransportError(`Resolved content scope is missing ${key}.`, {
        code: "CONTENT_SCOPE_INVALID",
        details: { key },
      });
    }
  }
}

function requireFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ContentTransportError(
      `CommonPlace GraphQL returned an invalid ${field} field.`,
      {
        code: "CONTENT_RESPONSE_INVALID",
        details: { field },
      }
    );
  }
  return value;
}

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ContentTransportError(
      `CommonPlace GraphQL returned an invalid ${field} field.`,
      {
        code: "CONTENT_RESPONSE_INVALID",
        details: { field },
      }
    );
  }
  return value;
}

function createContentTransport({
  driver = process.env.COMMONPLACE_CONTENT_TRANSPORT ?? "graphql",
  endpoint = process.env.COMMONPLACE_CONTENT_GRAPHQL_URL,
  apiKey = process.env.COMMONPLACE_CONTENT_API_KEY,
  fetchImpl = globalThis.fetch,
  unsafeAllowUnscopedScopeFallback =
    process.env.COMMONPLACE_UNSAFE_ALLOW_UNSCOPED_GRAPHQL === "1",
} = {}) {
  if (driver !== "graphql") {
    throw new ContentTransportError(`Unsupported content transport driver: ${driver}`, {
      code: "CONTENT_DRIVER_UNSUPPORTED",
      details: { driver },
    });
  }
  return new CommonplaceGraphqlTransport({
    endpoint,
    apiKey,
    fetchImpl,
    unsafeAllowUnscopedScopeFallback,
  });
}

module.exports = {
  CommonplaceGraphqlTransport,
  ContentTransport,
  ContentTransportError,
  UnsupportedContentOperationError,
  assertScope,
  createContentTransport,
};
