"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createIngestPipelineClient,
} = require("../../../utils/collectorApi/ingest-pipeline");

const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  workspaceId: "workspace-42",
  scopeRef: "workspace:workspace-42",
});

function collectorProvenance(correlationId, documentBindings) {
  return {
    kind: "collector",
    correlationId,
    upload: {
      filename: "research.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/research.txt",
    },
    serviceFacts: {
      parser: "commonplace-text-v1",
      mediaType: "text/plain",
      byteLength: 42,
      pageCount: 1,
    },
    documents: documentBindings.map((binding) => ({
      index: binding.index,
      documentDigest: binding.digest,
      parserDocumentId: `parser-${binding.index}`,
      docAuthor: "Source Author",
      description: "Parsed source",
    })),
  };
}

test("server configuration documents the required workspace scope map", () => {
  const envExample = fs.readFileSync(
    path.resolve(__dirname, "../../../.env.example"),
    "utf8"
  );
  const rawScopeMap = envExample.match(
    /^COMMONPLACE_WORKSPACE_SCOPE_MAP=(.+)$/mu
  )?.[1];

  assert.ok(rawScopeMap);
  assert.deepEqual(JSON.parse(rawScopeMap), {
    research: {
      tenant: "Travis-Gilbert",
      workspaceId: "workspace-42",
      scopeRef: "workspace:workspace-42",
    },
  });
});

test("collector batches call the content transport with stable source identity", async () => {
  let factoryCalls = 0;
  const calls = [];
  const client = createIngestPipelineClient({
    transportFactory() {
      factoryCalls += 1;
      return {
        async ingest(scope, document) {
          calls.push({ scope, document });
          return { id: `item-${calls.length}`, collections: ["collection-auto"] };
        },
      };
    },
  });
  assert.equal(factoryCalls, 0);

  const correlationId = "express-request-ingest-0001";
  const documentBindings = [{ index: 0, digest: "sha256:document" }];
  const receipts = await client.ingestBatch({
    scope: SCOPE,
    correlationId,
    idempotencyKey: "collector:sha256:batch",
    inputs: [
      {
        title: "Parsed passage",
        text: "The collector produced this text.",
        kind: "doc",
        tags: ["collector:peer"],
        source: "upload://workspace-42/research.txt",
      },
    ],
    documentBindings,
    provenance: collectorProvenance(correlationId, documentBindings),
  });

  assert.equal(factoryCalls, 1);
  assert.deepEqual(calls, [
    {
      scope: SCOPE,
      document: {
        title: "Parsed passage",
        text: "The collector produced this text.",
        kind: "doc",
        tags: ["collector:peer"],
        source: "upload://workspace-42/research.txt",
        idempotencyKey: "collector:sha256:batch",
        sourceRef: {
          source: "upload://workspace-42/research.txt",
          externalId:
            "collector:sha256:batch:document:0:sha256:document",
        },
        provenance: {
          kind: "collector",
          correlationId,
          upload: {
            filename: "research.txt",
            mediaType: "text/plain",
            source: "upload://workspace-42/research.txt",
          },
          serviceFacts: {
            parser: "commonplace-text-v1",
            mediaType: "text/plain",
            byteLength: 42,
            pageCount: 1,
          },
          document: {
            index: 0,
            documentDigest: "sha256:document",
            parserDocumentId: "parser-0",
            docAuthor: "Source Author",
            description: "Parsed source",
          },
        },
      },
    },
  ]);
  assert.deepEqual(receipts, [
    {
      item: { id: "item-1", collections: ["collection-auto"] },
      correlationId: "express-request-ingest-0001",
      idempotencyKey: "collector:sha256:batch",
      documentIndex: 0,
      documentDigest: "sha256:document",
    },
  ]);
});

test("misaligned collector batches fail before transport creation", async () => {
  let factoryCalls = 0;
  const client = createIngestPipelineClient({
    transportFactory() {
      factoryCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    client.ingestBatch({
      scope: SCOPE,
      correlationId: "express-request-ingest-0002",
      idempotencyKey: "collector:sha256:batch",
      inputs: [{}],
      documentBindings: [],
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  assert.equal(factoryCalls, 0);
});

test("batch idempotency is required before transport creation", async () => {
  let factoryCalls = 0;
  const client = createIngestPipelineClient({
    transportFactory() {
      factoryCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    client.ingestBatch({
      scope: SCOPE,
      correlationId: "express-request-ingest-0004",
      idempotencyKey: "",
      inputs: [{ source: "upload://workspace-42/research.txt" }],
      documentBindings: [{ index: 0, digest: "sha256:document" }],
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  assert.equal(factoryCalls, 0);
});

test("partial batch retries preserve per-document ingest identity", async () => {
  const calls = [];
  let failSecondDocument = true;
  const client = createIngestPipelineClient({
    transportFactory() {
      return {
        async ingest(_scope, document) {
          calls.push(document);
          if (document.title === "Second" && failSecondDocument) {
            failSecondDocument = false;
            throw new Error("transient ingest failure");
          }
          return { id: document.title.toLowerCase() };
        },
      };
    },
  });
  const correlationId = "express-request-ingest-retry";
  const documentBindings = [
    { index: 0, digest: "sha256:first" },
    { index: 1, digest: "sha256:second" },
  ];
  const batch = {
    scope: SCOPE,
    correlationId,
    idempotencyKey: "collector:sha256:retry-batch",
    inputs: [
      {
        title: "First",
        source: "upload://workspace-42/retry.txt",
      },
      {
        title: "Second",
        source: "upload://workspace-42/retry.txt",
      },
    ],
    documentBindings,
    provenance: collectorProvenance(correlationId, documentBindings),
  };

  await assert.rejects(client.ingestBatch(batch), /transient ingest failure/u);
  await assert.doesNotReject(client.ingestBatch(batch));

  assert.equal(calls.length, 4);
  assert.equal(calls[0].idempotencyKey, batch.idempotencyKey);
  assert.equal(
    calls[0].sourceRef.externalId,
    calls[2].sourceRef.externalId
  );
  assert.equal(
    calls[1].sourceRef.externalId,
    calls[3].sourceRef.externalId
  );
  assert.notEqual(
    calls[0].sourceRef.externalId,
    calls[1].sourceRef.externalId
  );
  assert.equal(calls[0].provenance.document.documentDigest, "sha256:first");
  assert.equal(calls[1].provenance.document.documentDigest, "sha256:second");
});

test("all collector provenance is validated before the first ingest", async () => {
  let transportCalls = 0;
  const client = createIngestPipelineClient({
    transportFactory() {
      return {
        async ingest() {
          transportCalls += 1;
          return { id: "unexpected" };
        },
      };
    },
  });
  const correlationId = "express-request-provenance-mismatch";
  const documentBindings = [
    { index: 0, digest: "sha256:first" },
    { index: 1, digest: "sha256:expected" },
  ];
  const provenance = collectorProvenance(correlationId, [
    documentBindings[0],
    { index: 1, digest: "sha256:different" },
  ]);

  await assert.rejects(
    client.ingestBatch({
      scope: SCOPE,
      correlationId,
      idempotencyKey: "collector:sha256:provenance",
      inputs: [
        {
          title: "First parsed passage",
          text: "first body",
          source: "upload://workspace-42/research.txt",
        },
        {
          title: "Second parsed passage",
          text: "second body",
          source: "upload://workspace-42/research.txt",
        },
      ],
      documentBindings,
      provenance,
    }),
    { code: "INGEST_PROVENANCE_INVALID" }
  );
  assert.equal(transportCalls, 0);
});

test("batches above the collector document cap fail before transport creation", async () => {
  let factoryCalls = 0;
  const client = createIngestPipelineClient({
    transportFactory() {
      factoryCalls += 1;
      return {};
    },
  });
  const correlationId = "express-request-document-limit";
  const documentBindings = Array.from({ length: 33 }, (_value, index) => ({
    index,
    digest: `sha256:document-${index}`,
  }));

  await assert.rejects(
    client.ingestBatch({
      scope: SCOPE,
      correlationId,
      idempotencyKey: "collector:sha256:too-many-documents",
      inputs: documentBindings.map((binding) => ({
        title: `Document ${binding.index}`,
        source: "upload://workspace-42/research.txt",
      })),
      documentBindings,
      provenance: collectorProvenance(correlationId, documentBindings),
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  assert.equal(factoryCalls, 0);
});

test("scope and document digests fail closed before transport creation", async () => {
  let factoryCalls = 0;
  const client = createIngestPipelineClient({
    transportFactory() {
      factoryCalls += 1;
      return {};
    },
  });
  const base = {
    correlationId: "express-request-ingest-0003",
    idempotencyKey: "collector:sha256:batch",
    inputs: [{ source: "upload://workspace-42/research.txt" }],
  };

  await assert.rejects(
    client.ingestBatch({
      ...base,
      scope: null,
      documentBindings: [{ index: 0, digest: "sha256:document" }],
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  await assert.rejects(
    client.ingestBatch({
      ...base,
      scope: SCOPE,
      documentBindings: [{ index: 0, digest: "" }],
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  await assert.rejects(
    client.ingestBatch({
      ...base,
      scope: SCOPE,
      documentBindings: [{ index: 1, digest: "sha256:document" }],
    }),
    { code: "INGEST_BATCH_INVALID" }
  );
  assert.equal(factoryCalls, 0);
});
