"use strict";

/*
 * CommonPlace peer boundary, informed by Mintplex-Labs/anything-llm's
 * collector/index.js at commit 633fc1960914298009134b40c25007cb422c7884.
 * AnythingLLM is MIT licensed; see LICENSE.anything-llm in this directory.
 */

const { timingSafeEqual } = require("node:crypto");

const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_DOCUMENTS = 32;
const DEFAULT_MAX_EXTRACTED_TEXT_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const DEFAULT_PARSE_TIMEOUT_MS = 60_000;
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

class CollectorServiceConfigurationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CollectorServiceConfigurationError";
    this.code = code;
  }
}

class PayloadTooLargeError extends Error {
  constructor(maxUploadBytes) {
    super(`Upload exceeds the configured ${maxUploadBytes} byte limit.`);
    this.name = "PayloadTooLargeError";
    this.statusCode = 413;
  }
}

class CollectorParserAbortedError extends Error {
  constructor() {
    super("Collector parsing did not complete before its deadline.");
    this.name = "CollectorParserAbortedError";
    this.statusCode = 503;
  }
}

function createCollectorRequestHandler({
  peerToken = process.env.COMMONPLACE_COLLECTOR_PEER_TOKEN,
  previousPeerToken = process.env.COMMONPLACE_COLLECTOR_PREVIOUS_PEER_TOKEN,
  parseBytes,
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  maxDocuments = DEFAULT_MAX_DOCUMENTS,
  maxExtractedTextBytes = DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  parseTimeoutMs = DEFAULT_PARSE_TIMEOUT_MS,
} = {}) {
  const peerTokens = normalizePeerTokens(peerToken, previousPeerToken);
  if (typeof parseBytes !== "function") {
    throw new CollectorServiceConfigurationError(
      "A parseBytes implementation is required.",
      "COLLECTOR_PARSER_MISSING"
    );
  }
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1) {
    throw new CollectorServiceConfigurationError(
      "maxUploadBytes must be a positive safe integer.",
      "COLLECTOR_UPLOAD_LIMIT_INVALID"
    );
  }
  if (!Number.isSafeInteger(maxDocuments) || maxDocuments < 1) {
    throw new CollectorServiceConfigurationError(
      "maxDocuments must be a positive safe integer.",
      "COLLECTOR_DOCUMENT_LIMIT_INVALID"
    );
  }
  if (
    !Number.isSafeInteger(maxExtractedTextBytes) ||
    maxExtractedTextBytes < 1
  ) {
    throw new CollectorServiceConfigurationError(
      "maxExtractedTextBytes must be a positive safe integer.",
      "COLLECTOR_TEXT_LIMIT_INVALID"
    );
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new CollectorServiceConfigurationError(
      "maxResponseBytes must be a positive safe integer.",
      "COLLECTOR_RESPONSE_LIMIT_INVALID"
    );
  }
  if (!Number.isSafeInteger(parseTimeoutMs) || parseTimeoutMs < 1) {
    throw new CollectorServiceConfigurationError(
      "parseTimeoutMs must be a positive safe integer.",
      "COLLECTOR_PARSE_TIMEOUT_INVALID"
    );
  }

  return function collectorRequestHandler(request, response) {
    handleRequest({
      request,
      response,
      peerTokens,
      parseBytes,
      maxUploadBytes,
      maxDocuments,
      maxExtractedTextBytes,
      maxResponseBytes,
      parseTimeoutMs,
    }).catch(() => {
      if (response.destroyed) {
        return;
      }
      if (!response.headersSent) {
        sendJson(response, 500, {
          success: false,
          reason: "Collector request failed.",
        });
      } else {
        response.destroy();
      }
    });
  };
}

async function handleRequest({
  request,
  response,
  peerTokens,
  parseBytes,
  maxUploadBytes,
  maxDocuments,
  maxExtractedTextBytes,
  maxResponseBytes,
  parseTimeoutMs,
}) {
  const requestUrl = new URL(request.url ?? "/", "http://collector.internal");

  if (request.method === "GET" && requestUrl.pathname === "/healthz") {
    sendJson(response, 200, { status: "ok", boundary: "parse-only" });
    return;
  }

  if (requestUrl.pathname !== "/v1/parse") {
    sendJson(response, 404, {
      success: false,
      reason: "Collector route not found.",
    });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, {
      success: false,
      reason: "Collector parse requires POST.",
    });
    return;
  }

  if (!hasValidPeerToken(request.headers.authorization, peerTokens)) {
    response.setHeader("www-authenticate", "Bearer");
    sendJson(response, 401, {
      success: false,
      reason: "Peer authentication required.",
    });
    return;
  }

  const correlationId = singleHeader(
    request.headers["x-commonplace-correlation-id"]
  );
  if (!isCorrelationId(correlationId)) {
    sendJson(response, 400, {
      success: false,
      reason: "A valid server correlation id is required.",
    });
    return;
  }

  const filename = requestUrl.searchParams.get("filename");
  if (!isFilename(filename)) {
    sendJson(response, 400, {
      success: false,
      correlationId,
      reason: "A valid logical filename is required.",
    });
    return;
  }

  const mediaType = singleHeader(request.headers["content-type"]);
  if (!isMediaType(mediaType)) {
    sendJson(response, 415, {
      success: false,
      correlationId,
      reason: "A valid content type is required.",
    });
    return;
  }

  try {
    const bytes = await readRequestBytes(request, maxUploadBytes);
    if (bytes.length === 0) {
      sendJson(response, 400, {
        success: false,
        correlationId,
        reason: "Upload bytes are required.",
      });
      return;
    }

    const parseController = new AbortController();
    const abortParsing = () => parseController.abort();
    request.once("aborted", abortParsing);
    response.once("close", abortParsing);
    const parseTimeout = setTimeout(abortParsing, parseTimeoutMs);
    let parsed;
    try {
      parsed = await runParserWithAbort(
        parseBytes,
        {
          bytes,
          filename,
          mediaType,
          correlationId,
          maxExtractedTextBytes,
        },
        parseController.signal
      );
    } finally {
      clearTimeout(parseTimeout);
      request.removeListener("aborted", abortParsing);
      response.removeListener("close", abortParsing);
    }
    const normalized = normalizeParserResult(parsed, {
      maxDocuments,
      maxExtractedTextBytes,
    });
    const successPayload = {
      success: true,
      correlationId,
      documents: normalized.documents,
      sourceFacts: normalized.sourceFacts,
    };
    if (measureJsonBytes(successPayload, maxResponseBytes) > maxResponseBytes) {
      const error = new Error(
        "Parser output exceeds the collector response limit."
      );
      error.statusCode = 422;
      throw error;
    }
    const serializedPayload = JSON.stringify(successPayload);
    sendJson(response, 200, successPayload, serializedPayload);
  } catch (error) {
    if (response.destroyed) {
      return;
    }
    const statusCode =
      Number.isInteger(error?.statusCode) &&
      error.statusCode >= 400 &&
      error.statusCode < 600
        ? error.statusCode
        : 500;
    sendJson(response, statusCode, {
      success: false,
      correlationId,
      reason:
        statusCode < 500
          ? error.message
          : "Collector parser failed without producing ingestible content.",
    });
  }
}

function normalizePeerTokens(peerToken, previousPeerToken) {
  assertPeerToken(peerToken);
  const tokens = [peerToken];
  if (
    previousPeerToken !== undefined &&
    previousPeerToken !== null &&
    previousPeerToken !== ""
  ) {
    assertPeerToken(previousPeerToken);
    tokens.push(previousPeerToken);
  }
  return Object.freeze([...new Set(tokens)]);
}

function assertPeerToken(peerToken) {
  if (
    typeof peerToken !== "string" ||
    peerToken.length < 32 ||
    isPlaceholderToken(peerToken)
  ) {
    throw new CollectorServiceConfigurationError(
      "Collector peer tokens must be non-placeholder secrets of at least 32 characters.",
      "COLLECTOR_PEER_TOKEN_MISSING"
    );
  }
}

function hasValidPeerToken(authorization, expectedTokens) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }

  const suppliedToken = authorization.slice("Bearer ".length);
  const supplied = Buffer.from(suppliedToken);
  const tokens = Array.isArray(expectedTokens) ? expectedTokens : [expectedTokens];
  let valid = false;
  for (const expectedToken of tokens) {
    const expected = Buffer.from(expectedToken);
    if (supplied.length === expected.length) {
      valid = timingSafeEqual(supplied, expected) || valid;
    }
  }
  return valid;
}

function isPlaceholderToken(token) {
  return /(replace|example|same-service-secret|change-me|set-a-random-secret)/iu.test(
    token
  );
}

function isCorrelationId(value) {
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value);
}

function isFilename(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    !value.includes("\0") &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function isMediaType(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;.*)?$/.test(value)
  );
}

function singleHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function readRequestBytes(request, maxUploadBytes) {
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxUploadBytes) {
    throw new PayloadTooLargeError(maxUploadBytes);
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.length;
    if (totalBytes > maxUploadBytes) {
      throw new PayloadTooLargeError(maxUploadBytes);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, totalBytes);
}

function normalizeParserResult(
  parsed,
  { maxDocuments, maxExtractedTextBytes }
) {
  if (!parsed || !Array.isArray(parsed.documents) || parsed.documents.length === 0) {
    const error = new Error("Parser returned no documents.");
    error.statusCode = 422;
    throw error;
  }
  if (parsed.documents.length > maxDocuments) {
    const error = new Error("Parser returned too many documents.");
    error.statusCode = 422;
    throw error;
  }
  let extractedTextBytes = 0;
  const documents = [];
  for (const [index, document] of parsed.documents.entries()) {
    if (!document || typeof document.pageContent !== "string") {
      const error = new Error(`Parser document ${index} contains no text.`);
      error.statusCode = 422;
      throw error;
    }
    extractedTextBytes += Buffer.byteLength(document.pageContent);
    if (extractedTextBytes > maxExtractedTextBytes) {
      const error = new Error("Parser output exceeds the extracted text limit.");
      error.statusCode = 422;
      throw error;
    }
    const normalizedDocument = {
      pageContent: document.pageContent,
    };
    copyBoundedText(normalizedDocument, "title", document.title, 512, index);
    copyBoundedText(normalizedDocument, "id", document.id, 255, index);
    copyBoundedText(
      normalizedDocument,
      "docAuthor",
      document.docAuthor,
      512,
      index
    );
    copyBoundedText(
      normalizedDocument,
      "description",
      document.description,
      2048,
      index
    );
    copyBoundedText(
      normalizedDocument,
      "published",
      document.published,
      128,
      index
    );
    copySafeCount(normalizedDocument, "wordCount", document.wordCount);
    copySafeCount(
      normalizedDocument,
      "token_count_estimate",
      document.token_count_estimate
    );
    documents.push(normalizedDocument);
  }

  return {
    documents,
    sourceFacts: normalizeSourceFacts(parsed.sourceFacts),
  };
}

function copyBoundedText(target, key, value, maxLength, documentIndex) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || value.length > maxLength) {
    const error = new Error(
      `Parser document ${documentIndex} has invalid ${key} metadata.`
    );
    error.statusCode = 422;
    throw error;
  }
  target[key] = value;
}

function copySafeCount(target, key, value) {
  if (Number.isSafeInteger(value) && value >= 0) {
    target[key] = value;
  }
}

function normalizeSourceFacts(sourceFacts) {
  if (
    !sourceFacts ||
    typeof sourceFacts !== "object" ||
    Array.isArray(sourceFacts)
  ) {
    return {};
  }
  const normalized = {};
  copyBoundedText(normalized, "parser", sourceFacts.parser, 128, "source");
  copyBoundedText(
    normalized,
    "mediaType",
    sourceFacts.mediaType,
    255,
    "source"
  );
  copySafeCount(normalized, "byteLength", sourceFacts.byteLength);
  copySafeCount(normalized, "pageCount", sourceFacts.pageCount);
  return normalized;
}

async function runParserWithAbort(parseBytes, input, signal) {
  if (signal.aborted) {
    throw new CollectorParserAbortedError();
  }
  let rejectOnAbort;
  const aborted = new Promise((_resolve, reject) => {
    rejectOnAbort = () => reject(new CollectorParserAbortedError());
    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => parseBytes({ ...input, signal })),
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", rejectOnAbort);
  }
}

function measureJsonBytes(value, maxBytes = Number.MAX_SAFE_INTEGER) {
  let total = 0;
  const active = new Set();
  const add = (bytes) => {
    total += bytes;
    return total <= maxBytes;
  };

  const visit = (entry, inArray = false) => {
    if (entry === null) return add(4);
    if (typeof entry === "string") return add(jsonStringByteLength(entry));
    if (typeof entry === "boolean") return add(entry ? 4 : 5);
    if (typeof entry === "number") {
      return add(Buffer.byteLength(JSON.stringify(entry)));
    }
    if (
      entry === undefined ||
      typeof entry === "function" ||
      typeof entry === "symbol"
    ) {
      return inArray ? add(4) : true;
    }
    if (typeof entry === "bigint") {
      throw new TypeError("BigInt values cannot be serialized as JSON.");
    }
    if (typeof entry !== "object") {
      return add(Buffer.byteLength(JSON.stringify(entry)));
    }
    if (active.has(entry)) {
      throw new TypeError("Circular collector payload cannot be serialized.");
    }
    active.add(entry);
    let withinLimit = true;
    if (Array.isArray(entry)) {
      withinLimit = add(1);
      for (let index = 0; withinLimit && index < entry.length; index += 1) {
        if (index > 0) withinLimit = add(1);
        if (withinLimit) withinLimit = visit(entry[index], true);
      }
      if (withinLimit) withinLimit = add(1);
    } else {
      withinLimit = add(1);
      let emitted = 0;
      for (const key of Object.keys(entry)) {
        const child = entry[key];
        if (
          child === undefined ||
          typeof child === "function" ||
          typeof child === "symbol"
        ) {
          continue;
        }
        if (emitted > 0) withinLimit = add(1);
        if (!withinLimit) break;
        withinLimit = add(jsonStringByteLength(key));
        if (withinLimit) withinLimit = add(1);
        if (withinLimit) withinLimit = visit(child);
        emitted += 1;
        if (!withinLimit) break;
      }
      if (withinLimit) withinLimit = add(1);
    }
    active.delete(entry);
    return withinLimit;
  };

  visit(value);
  return total;
}

function jsonStringByteLength(value) {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) {
      bytes += 2;
    } else if (
      code === 0x08 ||
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0c ||
      code === 0x0d
    ) {
      bytes += 2;
    } else if (code <= 0x1f) {
      bytes += 6;
    } else if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 6;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      bytes += 6;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function sendJson(response, statusCode, payload, serializedPayload = null) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(serializedPayload ?? JSON.stringify(payload));
}

module.exports = {
  CollectorParserAbortedError,
  CollectorServiceConfigurationError,
  DEFAULT_MAX_DOCUMENTS,
  DEFAULT_MAX_EXTRACTED_TEXT_BYTES,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_PARSE_TIMEOUT_MS,
  PayloadTooLargeError,
  createCollectorRequestHandler,
  hasValidPeerToken,
  isCorrelationId,
  measureJsonBytes,
  normalizePeerTokens,
};
