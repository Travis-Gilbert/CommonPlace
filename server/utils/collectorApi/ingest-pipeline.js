"use strict";

const {
  createContentTransport,
} = require("../vectorDbProviders/rustyred/content-transport");

const MAX_DOCUMENTS = 32;

class IngestPipelineClientError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = "IngestPipelineClientError";
    this.code = code;
    this.details = details;
  }
}

function createIngestPipelineClient({
  transportFactory = createContentTransport,
} = {}) {
  if (typeof transportFactory !== "function") {
    throw new IngestPipelineClientError(
      "A content transport factory is required.",
      "INGEST_TRANSPORT_FACTORY_MISSING"
    );
  }

  return Object.freeze({
    async ingestBatch({
      scope,
      correlationId,
      idempotencyKey,
      inputs,
      documentBindings,
      provenance,
    }) {
      if (
        !scope ||
        typeof scope !== "object" ||
        typeof scope.scopeRef !== "string" ||
        scope.scopeRef.trim().length === 0 ||
        typeof correlationId !== "string" ||
        correlationId.trim().length === 0 ||
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length === 0 ||
        !Array.isArray(inputs) ||
        !Array.isArray(documentBindings) ||
        inputs.length === 0 ||
        inputs.length > MAX_DOCUMENTS ||
        inputs.length !== documentBindings.length ||
        documentBindings.some(
          (binding, index) =>
            !binding ||
            typeof binding !== "object" ||
            !Number.isSafeInteger(binding.index) ||
            binding.index < 0 ||
            binding.index !== index ||
            typeof binding.digest !== "string" ||
            binding.digest.trim().length === 0
        )
      ) {
        throw new IngestPipelineClientError(
          "Ingest inputs and document bindings must be non-empty and aligned.",
          "INGEST_BATCH_INVALID"
        );
      }
      const documentProvenances = documentBindings.map((binding) =>
        provenanceForDocument({ provenance, correlationId, binding })
      );

      // Resolve lazily so an unavailable graph tier never prevents the
      // identity service from starting or serving login.
      const transport = transportFactory();
      if (typeof transport?.ingest !== "function") {
        throw new IngestPipelineClientError(
          "The content transport does not expose ingest.",
          "INGEST_TRANSPORT_INVALID"
        );
      }

      const receipts = [];
      for (const [index, input] of inputs.entries()) {
        const binding = documentBindings[index];
        const documentProvenance = documentProvenances[index];
        const documentIdempotencyKey = [
          idempotencyKey,
          "document",
          binding.index,
          binding.digest,
        ].join(":");
        const item = await transport.ingest(scope, {
          ...input,
          idempotencyKey,
          sourceRef: {
            source: input.source,
            externalId: documentIdempotencyKey,
          },
          provenance: documentProvenance,
        });
        receipts.push({
          item,
          correlationId,
          idempotencyKey,
          documentIndex: binding.index,
          documentDigest: binding.digest,
        });
      }
      return receipts;
    },
  });
}

function provenanceForDocument({ provenance, correlationId, binding }) {
  const document = provenance?.documents?.[binding.index];
  if (
    provenance?.kind !== "collector" ||
    provenance.correlationId !== correlationId ||
    !isRecord(provenance.upload) ||
    !isRecord(provenance.serviceFacts) ||
    !Array.isArray(provenance.documents) ||
    !isRecord(document) ||
    document.index !== binding.index ||
    document.documentDigest !== binding.digest
  ) {
    throw new IngestPipelineClientError(
      "Collector provenance must match the admitted batch and document digest.",
      "INGEST_PROVENANCE_INVALID"
    );
  }

  return Object.freeze({
    kind: "collector",
    correlationId,
    upload: Object.freeze({ ...provenance.upload }),
    serviceFacts: Object.freeze({ ...provenance.serviceFacts }),
    document: Object.freeze({ ...document }),
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  IngestPipelineClientError,
  createIngestPipelineClient,
};
