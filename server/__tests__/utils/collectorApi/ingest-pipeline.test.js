"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createIngestPipelineClient,
} = require("../../../utils/collectorApi/ingest-pipeline");

const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  workspaceId: "workspace-42",
  scopeRef: "workspace:workspace-42",
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

  const receipts = await client.ingestBatch({
    scope: SCOPE,
    correlationId: "express-request-ingest-0001",
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
    documentBindings: [{ index: 0, digest: "sha256:document" }],
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
        sourceRef: {
          source: "upload://workspace-42/research.txt",
          externalId: "workspace:workspace-42:sha256:document",
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
  assert.equal(factoryCalls, 0);
});
