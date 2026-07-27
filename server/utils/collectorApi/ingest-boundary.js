"use strict";

const { createHash, randomUUID } = require("node:crypto");

const { CollectorApi, isCorrelationId } = require(".");

const MAX_DOCUMENTS = 32;
const MAX_EXTRACTED_TEXT_BYTES = 16 * 1024 * 1024;
const MAX_TAGS = 32;

class CollectorIngestBoundaryError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = "CollectorIngestBoundaryError";
    this.code = code;
    this.details = details;
  }
}

function createCollectorIngestBoundary({
  collectorApi = new CollectorApi(),
  resolveScope,
  ingestPipeline,
  randomUUIDImpl = randomUUID,
} = {}) {
  if (typeof resolveScope !== "function") {
    throw new CollectorIngestBoundaryError(
      "An Express scope resolver is required.",
      "COLLECTOR_SCOPE_RESOLVER_MISSING"
    );
  }
  if (typeof ingestPipeline?.ingestBatch !== "function") {
    throw new CollectorIngestBoundaryError(
      "An IngestPipeline ingestBatch boundary is required.",
      "COLLECTOR_INGEST_PIPELINE_MISSING"
    );
  }
  if (typeof randomUUIDImpl !== "function") {
    throw new CollectorIngestBoundaryError(
      "A correlation id generator is required.",
      "COLLECTOR_CORRELATION_GENERATOR_MISSING"
    );
  }

  return Object.freeze({
    async ingestUpload({
      request,
      workspaceId,
      bytes,
      filename,
      mediaType,
      source,
      tags = [],
    }) {
      assertString(workspaceId, "workspaceId", "COLLECTOR_WORKSPACE_INVALID");
      const normalizedTags = normalizeTags(tags);

      const resolvedScope = await resolveScope({ request, workspaceId });
      const scope = freezeScope(resolvedScope);
      if (scope.workspaceId !== workspaceId) {
        throw new CollectorIngestBoundaryError(
          "The admitted scope does not match the requested workspace.",
          "COLLECTOR_SCOPE_WORKSPACE_MISMATCH"
        );
      }
      const authoritativeSource = createUploadSource(workspaceId, filename);
      if (source !== undefined && source !== authoritativeSource) {
        throw new CollectorIngestBoundaryError(
          "Upload source must match the server-derived workspace source.",
          "COLLECTOR_SOURCE_MISMATCH"
        );
      }
      const correlationId = deriveExpressCorrelationId(request, randomUUIDImpl);
      const parsed = await collectorApi.parseBytes({
        bytes,
        filename,
        mediaType,
        correlationId,
      });
      if (parsed?.correlationId !== correlationId) {
        throw new CollectorIngestBoundaryError(
          "Collector response correlation did not match the Express request.",
          "COLLECTOR_CORRELATION_MISMATCH"
        );
      }
      const normalizedDocuments = normalizeDocuments(parsed.documents, {
        filename,
        source: authoritativeSource,
        tags: normalizedTags,
      });
      const documentBindings = createDocumentBindings(normalizedDocuments);
      const idempotencyKey = createUploadIdempotencyKey({
        scope,
        filename,
        mediaType,
        bytes,
        tags: normalizedTags,
        documentBindings,
      });
      const provenance = createProvenance({
        correlationId,
        filename,
        mediaType,
        source: authoritativeSource,
        documents: parsed.documents,
        documentBindings,
        serviceFacts: parsed.sourceFacts,
      });

      const rawReceipts = await ingestPipeline.ingestBatch({
        scope,
        correlationId,
        idempotencyKey,
        inputs: normalizedDocuments,
        documentBindings,
        provenance,
      });
      const receipts = validateReceipts(rawReceipts, {
        correlationId,
        idempotencyKey,
        documentBindings,
      });

      return {
        correlationId,
        idempotencyKey,
        scopeRef: scope.scopeRef,
        receipts,
      };
    },
  });
}

function deriveExpressCorrelationId(request, randomUUIDImpl = randomUUID) {
  const expressRequestId = request?.id;
  if (isCorrelationId(expressRequestId)) {
    return expressRequestId;
  }

  const generated = randomUUIDImpl();
  if (!isCorrelationId(generated)) {
    throw new CollectorIngestBoundaryError(
      "Express correlation id generation failed.",
      "COLLECTOR_CORRELATION_INVALID"
    );
  }
  return generated;
}

function freezeScope(scope) {
  for (const key of ["tenant", "workspaceId", "scopeRef"]) {
    assertString(scope?.[key], key, "COLLECTOR_SCOPE_INVALID");
  }
  return Object.freeze({
    tenant: scope.tenant,
    workspaceId: scope.workspaceId,
    scopeRef: scope.scopeRef,
  });
}

function normalizeDocuments(
  documents,
  { filename, source, tags }
) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new CollectorIngestBoundaryError(
      "Collector returned no documents.",
      "COLLECTOR_DOCUMENTS_MISSING"
    );
  }
  if (documents.length > MAX_DOCUMENTS) {
    throw new CollectorIngestBoundaryError(
      "Collector returned too many documents.",
      "COLLECTOR_DOCUMENT_LIMIT_EXCEEDED"
    );
  }

  let extractedTextBytes = 0;
  const normalized = documents.map((document, index) => {
    if (
      !document ||
      typeof document.pageContent !== "string" ||
      document.pageContent.trim().length === 0
    ) {
      throw new CollectorIngestBoundaryError(
        `Collector document ${index} contains no text.`,
        "COLLECTOR_DOCUMENT_INVALID",
        { index }
      );
    }
    extractedTextBytes += Buffer.byteLength(document.pageContent);
    if (extractedTextBytes > MAX_EXTRACTED_TEXT_BYTES) {
      throw new CollectorIngestBoundaryError(
        "Collector output exceeds the extracted text limit.",
        "COLLECTOR_TEXT_LIMIT_EXCEEDED"
      );
    }

    const title =
      typeof document.title === "string" && document.title.trim().length > 0
        ? document.title
        : filename;
    return {
      title,
      text: document.pageContent,
      kind: "doc",
      tags: Object.freeze([
        ...new Set([
          ...tags,
          "collector:peer",
        ]),
      ]),
      source,
    };
  });

  return Object.freeze(normalized.map((document) => Object.freeze(document)));
}

function createProvenance({
  correlationId,
  filename,
  mediaType,
  source,
  documents,
  documentBindings,
  serviceFacts,
}) {
  return Object.freeze({
    kind: "collector",
    correlationId,
    upload: Object.freeze({ filename, mediaType, source }),
    serviceFacts: freezeRecord({
      parser: safeText(serviceFacts?.parser, 128),
      mediaType: safeText(serviceFacts?.mediaType, 255),
      byteLength: safeCount(serviceFacts?.byteLength),
      pageCount: safeCount(serviceFacts?.pageCount),
    }),
    documents: Object.freeze(
      documents.map((document, index) =>
        freezeRecord({
          index,
          documentDigest: documentBindings[index]?.digest ?? null,
          parserDocumentId: safeText(document.id, 255),
          docAuthor: safeText(document.docAuthor, 512),
          description: safeText(document.description, 2048),
          published: safeText(document.published, 128),
          wordCount: safeCount(document.wordCount),
          tokenCountEstimate: safeCount(document.token_count_estimate),
        })
      )
    ),
  });
}

function createUploadSource(workspaceId, filename) {
  assertString(filename, "filename", "COLLECTOR_FILENAME_INVALID");
  if (filename.includes("/") || filename.includes("\\") || filename.includes("\0")) {
    throw new CollectorIngestBoundaryError(
      "Upload filename must be a logical basename.",
      "COLLECTOR_FILENAME_INVALID"
    );
  }
  return `upload://${encodeURIComponent(workspaceId)}/${encodeURIComponent(
    filename
  )}`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    throw new CollectorIngestBoundaryError(
      `Upload tags must contain at most ${MAX_TAGS} strings.`,
      "COLLECTOR_TAGS_INVALID"
    );
  }
  const normalized = [];
  for (const tag of tags) {
    if (
      typeof tag !== "string" ||
      tag.trim().length === 0 ||
      tag.trim().length > 64 ||
      tag.trim().startsWith("collector:")
    ) {
      throw new CollectorIngestBoundaryError(
        "Upload tags must be non-empty strings of at most 64 characters and cannot use the collector namespace.",
        "COLLECTOR_TAGS_INVALID"
      );
    }
    normalized.push(tag.trim());
  }
  return Object.freeze([...new Set(normalized)].sort());
}

function validateReceipts(
  receipts,
  { correlationId, idempotencyKey, documentBindings }
) {
  if (
    !Array.isArray(receipts) ||
    receipts.length !== documentBindings.length
  ) {
    throw new CollectorIngestBoundaryError(
      "IngestPipeline did not return one receipt per parsed document.",
      "COLLECTOR_INGEST_RECEIPT_INVALID"
    );
  }
  const itemIds = new Set();
  for (const [index, receipt] of receipts.entries()) {
    const binding = documentBindings[index];
    if (
      !receipt ||
      typeof receipt !== "object" ||
      typeof receipt.item?.id !== "string" ||
      receipt.item.id.trim().length === 0 ||
      receipt.correlationId !== correlationId ||
      receipt.idempotencyKey !== idempotencyKey ||
      receipt.documentIndex !== binding.index ||
      receipt.documentDigest !== binding.digest ||
      itemIds.has(receipt.item.id)
    ) {
      throw new CollectorIngestBoundaryError(
        `IngestPipeline receipt ${index} does not prove the idempotent batch identity.`,
        "COLLECTOR_INGEST_RECEIPT_INVALID",
        { index }
      );
    }
    itemIds.add(receipt.item.id);
  }
  return Object.freeze(receipts.map((receipt) => freezeRecord(receipt)));
}

function createUploadIdempotencyKey({
  scope,
  filename,
  mediaType,
  bytes,
  tags = [],
  documentBindings = [],
}) {
  const uploadBytes = normalizeDigestBytes(bytes);
  const hash = createHash("sha256");
  updateDigestField(hash, "tenant", scope.tenant);
  updateDigestField(hash, "workspace", scope.workspaceId);
  updateDigestField(hash, "scope", scope.scopeRef);
  updateDigestField(hash, "filename", filename);
  updateDigestField(hash, "mediaType", mediaType);
  updateDigestField(hash, "bytes", uploadBytes);
  for (const tag of tags) {
    updateDigestField(hash, "tag", tag);
  }
  for (const binding of documentBindings) {
    updateDigestField(hash, "documentIndex", binding.index);
    updateDigestField(hash, "documentDigest", binding.digest);
  }
  return `collector:sha256:${hash.digest("hex")}`;
}

function createDocumentBindings(documents) {
  return Object.freeze(
    documents.map((document, index) => {
      const hash = createHash("sha256");
      updateDigestField(hash, "title", document.title);
      updateDigestField(hash, "text", document.text);
      updateDigestField(hash, "kind", document.kind);
      updateDigestField(hash, "source", document.source);
      for (const tag of document.tags) {
        updateDigestField(hash, "tag", tag);
      }
      return Object.freeze({
        index,
        digest: `sha256:${hash.digest("hex")}`,
      });
    })
  );
}

function updateDigestField(hash, label, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  hash.update(label);
  hash.update("\0");
  hash.update(String(bytes.length));
  hash.update("\0");
  hash.update(bytes);
}

function normalizeDigestBytes(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  throw new CollectorIngestBoundaryError(
    "Upload bytes must be Buffer, Uint8Array, or ArrayBuffer.",
    "COLLECTOR_BYTES_INVALID"
  );
}

function safeText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function freezeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({});
  }
  return Object.freeze({ ...value });
}

function assertString(value, field, code) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CollectorIngestBoundaryError(
      `${field} must be a non-empty string.`,
      code,
      { field }
    );
  }
}

module.exports = {
  CollectorIngestBoundaryError,
  createCollectorIngestBoundary,
  createDocumentBindings,
  createProvenance,
  createUploadIdempotencyKey,
  createUploadSource,
  deriveExpressCorrelationId,
  freezeScope,
  normalizeDocuments,
  normalizeTags,
  validateReceipts,
};
