"use strict";

/*
 * CommonPlace collector client. The API shape replaces the shared-filesystem
 * client reviewed in Mintplex-Labs/anything-llm at commit
 * 633fc1960914298009134b40c25007cb422c7884. AnythingLLM is MIT licensed; see
 * server/LICENSE.anything-llm.
 */

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DEFAULT_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

class CollectorApiError extends Error {
  constructor(
    message,
    {
      code = "COLLECTOR_API_ERROR",
      retryable = false,
      status = null,
      details = null,
    } = {}
  ) {
    super(message);
    this.name = "CollectorApiError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.details = details;
  }
}

class CollectorApiConfigurationError extends CollectorApiError {
  constructor(message, code) {
    super(message, { code });
    this.name = "CollectorApiConfigurationError";
  }
}

class CollectorUnavailableError extends CollectorApiError {
  constructor(message, { code = "COLLECTOR_UNAVAILABLE", details = null } = {}) {
    super(message, { code, retryable: true, details });
    this.name = "CollectorUnavailableError";
  }
}

class CollectorApi {
  #baseUrl;
  #fetch;
  #peerToken;
  #maxResponseBytes;
  #timeoutMs;

  constructor({
    baseUrl = process.env.COMMONPLACE_COLLECTOR_URL,
    peerToken = process.env.COMMONPLACE_COLLECTOR_PEER_TOKEN,
    fetchImpl = globalThis.fetch,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs = 60_000,
  } = {}) {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
    this.#peerToken = normalizePeerToken(peerToken);
    if (typeof fetchImpl !== "function") {
      throw new CollectorApiConfigurationError(
        "A fetch implementation is required.",
        "COLLECTOR_FETCH_MISSING"
      );
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
      throw new CollectorApiConfigurationError(
        "Collector timeout must be a positive safe integer.",
        "COLLECTOR_TIMEOUT_INVALID"
      );
    }
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
      throw new CollectorApiConfigurationError(
        "Collector response limit must be a positive safe integer.",
        "COLLECTOR_RESPONSE_LIMIT_INVALID"
      );
    }
    this.#fetch = fetchImpl;
    this.#maxResponseBytes = maxResponseBytes;
    this.#timeoutMs = timeoutMs;
  }

  get baseUrl() {
    return this.#baseUrl;
  }

  async parseBytes({ bytes, filename, mediaType, correlationId }) {
    const body = normalizeBytes(bytes);
    if (body.length === 0) {
      throw new CollectorApiError("Upload bytes are required.", {
        code: "COLLECTOR_BYTES_MISSING",
      });
    }
    if (
      typeof filename !== "string" ||
      filename.length === 0 ||
      filename.length > 255 ||
      filename.includes("\0") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      throw new CollectorApiError("A valid logical filename is required.", {
        code: "COLLECTOR_FILENAME_INVALID",
      });
    }
    if (typeof mediaType !== "string" || !mediaType.includes("/")) {
      throw new CollectorApiError("A valid media type is required.", {
        code: "COLLECTOR_MEDIA_TYPE_INVALID",
      });
    }
    if (!isCorrelationId(correlationId)) {
      throw new CollectorApiError("A valid server correlation id is required.", {
        code: "COLLECTOR_CORRELATION_INVALID",
      });
    }

    const endpoint = new URL(`${this.#baseUrl}/v1/parse`);
    endpoint.searchParams.set("filename", filename);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    let response;
    let payload;
    try {
      response = await this.#fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#peerToken}`,
          "content-type": mediaType,
          "x-commonplace-correlation-id": correlationId,
        },
        body,
        signal: controller.signal,
      });
      payload = await readJsonResponse(response, this.#maxResponseBytes);
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new CollectorUnavailableError("Collector request timed out.", {
          code: "COLLECTOR_TIMEOUT",
        });
      }
      if (error instanceof CollectorApiError) {
        throw error;
      }
      throw new CollectorUnavailableError("Collector peer is unavailable.", {
        details: { cause: error?.message ?? String(error) },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new CollectorUnavailableError(
          "Collector peer failed while parsing the upload.",
          {
            code: "COLLECTOR_PEER_FAILURE",
            details: {
              status: response.status,
              reason: payload?.reason ?? null,
            },
          }
        );
      }
      throw new CollectorApiError("Collector peer refused the upload.", {
        code: "COLLECTOR_REQUEST_REFUSED",
        status: response.status,
        details: { reason: payload?.reason ?? null },
      });
    }

    if (payload?.correlationId !== correlationId) {
      throw new CollectorApiError(
        "Collector response correlation did not match the Express request.",
        { code: "COLLECTOR_CORRELATION_MISMATCH" }
      );
    }
    if (
      payload.success !== true ||
      !Array.isArray(payload.documents) ||
      payload.documents.length === 0
    ) {
      throw new CollectorApiError(
        "Collector peer returned no ingestible documents.",
        { code: "COLLECTOR_RESPONSE_INVALID" }
      );
    }

    return {
      correlationId,
      documents: payload.documents,
      sourceFacts:
        payload.sourceFacts &&
        typeof payload.sourceFacts === "object" &&
        !Array.isArray(payload.sourceFacts)
          ? payload.sourceFacts
          : {},
    };
  }
}

async function readJsonResponse(response, maxResponseBytes) {
  if (!response || typeof response.ok !== "boolean") {
    throw new CollectorApiError("Collector returned an invalid HTTP response.", {
      code: "COLLECTOR_HTTP_RESPONSE_INVALID",
    });
  }
  try {
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          totalBytes += chunk.value.byteLength;
          if (totalBytes > maxResponseBytes) {
            throw new CollectorApiError(
              "Collector response exceeded the configured limit.",
              {
                code: "COLLECTOR_RESPONSE_TOO_LARGE",
                status: response.status ?? null,
              }
            );
          }
          chunks.push(Buffer.from(chunk.value));
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return JSON.parse(Buffer.concat(chunks, totalBytes).toString("utf8"));
    }
    const payload = await response.json();
    if (Buffer.byteLength(JSON.stringify(payload)) > maxResponseBytes) {
      throw new CollectorApiError(
        "Collector response exceeded the configured limit.",
        {
          code: "COLLECTOR_RESPONSE_TOO_LARGE",
          status: response.status ?? null,
        }
      );
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    if (error instanceof CollectorApiError) {
      throw error;
    }
    if (response.status >= 500) {
      throw new CollectorUnavailableError(
        "Collector peer returned an invalid failure response.",
        {
          code: "COLLECTOR_PEER_INVALID_RESPONSE",
          details: { status: response.status },
        }
      );
    }
    if (response.status >= 400) {
      throw new CollectorApiError(
        "Collector returned an invalid refusal response.",
        {
          code: "COLLECTOR_REFUSAL_INVALID_RESPONSE",
          status: response.status ?? null,
        }
      );
    }
    throw new CollectorUnavailableError(
      "Collector returned an incomplete or invalid success response.",
      {
        code: "COLLECTOR_PEER_INVALID_RESPONSE",
        details: { status: response.status ?? null },
      }
    );
  }
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new CollectorApiConfigurationError(
      "COMMONPLACE_COLLECTOR_URL is required.",
      "COLLECTOR_URL_MISSING"
    );
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new CollectorApiConfigurationError(
      "COMMONPLACE_COLLECTOR_URL must be a valid URL.",
      "COLLECTOR_URL_INVALID"
    );
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new CollectorApiConfigurationError(
      "COMMONPLACE_COLLECTOR_URL must use HTTP or HTTPS.",
      "COLLECTOR_URL_INVALID"
    );
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new CollectorApiConfigurationError(
      "COMMONPLACE_COLLECTOR_URL cannot contain credentials, a query, or a fragment.",
      "COLLECTOR_URL_INVALID"
    );
  }
  return parsed.toString().replace(/\/+$/u, "");
}

function normalizePeerToken(peerToken) {
  if (
    typeof peerToken !== "string" ||
    peerToken.length < 32 ||
    /(replace|example|same-service-secret|change-me|set-a-random-secret)/iu.test(
      peerToken
    )
  ) {
    throw new CollectorApiConfigurationError(
      "COMMONPLACE_COLLECTOR_PEER_TOKEN must be a non-placeholder secret of at least 32 characters.",
      "COLLECTOR_PEER_TOKEN_MISSING"
    );
  }
  return peerToken;
}

function isCorrelationId(value) {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value);
}

function normalizeBytes(bytes) {
  if (Buffer.isBuffer(bytes)) {
    return bytes;
  }
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }
  throw new CollectorApiError(
    "Collector byte transport requires Buffer, Uint8Array, or ArrayBuffer.",
    { code: "COLLECTOR_BYTES_INVALID" }
  );
}

module.exports = {
  CollectorApi,
  CollectorApiConfigurationError,
  CollectorApiError,
  CollectorUnavailableError,
  DEFAULT_MAX_RESPONSE_BYTES,
  isCorrelationId,
  normalizeBaseUrl,
};
