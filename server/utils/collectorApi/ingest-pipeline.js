"use strict";

const {
  createContentTransport,
} = require("../vectorDbProviders/rustyred/content-transport");

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
    }) {
      if (
        !scope ||
        typeof scope !== "object" ||
        typeof scope.scopeRef !== "string" ||
        scope.scopeRef.trim().length === 0 ||
        typeof idempotencyKey !== "string" ||
        idempotencyKey.trim().length === 0 ||
        !Array.isArray(inputs) ||
        !Array.isArray(documentBindings) ||
        inputs.length === 0 ||
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

module.exports = {
  IngestPipelineClientError,
  createIngestPipelineClient,
};
