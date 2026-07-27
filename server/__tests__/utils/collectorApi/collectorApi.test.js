"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const {
  CollectorApi,
  CollectorApiConfigurationError,
} = require("../../../utils/collectorApi");
const {
  createCollectorIngestBoundary,
  deriveExpressCorrelationId,
} = require("../../../utils/collectorApi/ingest-boundary");
const {
  createCollectorRequestHandler,
  measureJsonBytes,
} = require("../../../../collector/service");
const {
  countWords,
  getParserWorkerState,
  parseDocumentBytes,
  parseDocumentBytesInWorker,
} = require("../../../../collector/parser");
const { startCollector } = require("../../../../collector");

const PEER_TOKEN = "collector-peer-token-for-focused-tests";
const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  workspaceId: "workspace-42",
  scopeRef: "project:commonplace",
});

test("collector startup rejects asynchronous bind failures", async (t) => {
  const blocker = http.createServer((_request, response) => response.end());
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        blocker.close((error) => (error ? reject(error) : resolve()));
      })
  );
  const address = blocker.address();

  await assert.rejects(
    startCollector({
      host: "127.0.0.1",
      port: address.port,
      peerToken: PEER_TOKEN,
      async parseBytes() {
        return { documents: [] };
      },
    }),
    { code: "EADDRINUSE" }
  );
});

test("collector refuses unauthenticated calls before parsing and never admits request scope", async (t) => {
  const parserCalls = [];
  assert.throws(
    () =>
      createCollectorRequestHandler({
        peerToken: "",
        async parseBytes() {
          return { documents: [] };
        },
      }),
    { code: "COLLECTOR_PEER_TOKEN_MISSING" }
  );
  assert.throws(
    () =>
      createCollectorRequestHandler({
        peerToken: "",
        previousPeerToken: "the-prior-random-32-character-secret",
        async parseBytes() {
          return { documents: [] };
        },
      }),
    { code: "COLLECTOR_PEER_TOKEN_MISSING" }
  );
  assert.throws(
    () =>
      createCollectorRequestHandler({
        peerToken: "replace-with-a-service-secret-that-is-long-enough",
        async parseBytes() {
          return { documents: [] };
        },
      }),
    { code: "COLLECTOR_PEER_TOKEN_MISSING" }
  );
  assert.throws(
    () =>
      createCollectorRequestHandler({
        peerToken: "set-a-random-secret-with-at-least-32-characters",
        async parseBytes() {
          return { documents: [] };
        },
      }),
    { code: "COLLECTOR_PEER_TOKEN_MISSING" }
  );
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    async parseBytes(input) {
      parserCalls.push(input);
      return {
        documents: [
          {
            title: input.filename,
            pageContent: input.bytes.toString("utf8"),
          },
        ],
        sourceFacts: { parser: "test" },
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const endpoint = `${baseUrl}/v1/parse?filename=notes.txt`;

  const unauthenticated = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "private notes",
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(parserCalls.length, 0);

  const missingCorrelation = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
    },
    body: "private notes",
  });
  assert.equal(missingCorrelation.status, 400);
  assert.equal(parserCalls.length, 0);

  const admittedPeer = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-0001",
      "x-commonplace-tenant": "forged-tenant",
      "x-commonplace-workspace": "forged-workspace",
    },
    body: "private notes",
  });
  assert.equal(admittedPeer.status, 200);
  assert.equal(parserCalls.length, 1);
  assert.deepEqual(parserCalls[0].bytes, Buffer.from("private notes"));
  assert.equal(parserCalls[0].filename, "notes.txt");
  assert.equal(parserCalls[0].correlationId, "express-request-0001");
  assert.equal(Object.hasOwn(parserCalls[0], "tenant"), false);
  assert.equal(Object.hasOwn(parserCalls[0], "workspaceId"), false);
});

test("collector accepts the previous peer token during an explicit rotation overlap", async (t) => {
  const previousPeerToken = "collector-previous-peer-token-for-rotation";
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    previousPeerToken,
    async parseBytes() {
      return {
        documents: [{ title: "Rotation", pageContent: "accepted" }],
        sourceFacts: { parser: "rotation-test" },
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const response = await fetch(`${baseUrl}/v1/parse?filename=rotation.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${previousPeerToken}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-rotation-1",
    },
    body: "accepted",
  });

  assert.equal(response.status, 200);
});

test("collector bounds extracted output independently from upload bytes", async (t) => {
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    maxExtractedTextBytes: 5,
    async parseBytes() {
      return {
        documents: [{ title: "Expanded", pageContent: "123456" }],
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const response = await fetch(`${baseUrl}/v1/parse?filename=expanded.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-expanded-1",
    },
    body: "tiny",
  });

  assert.equal(response.status, 422);
});

test("collector propagates its deadline through the parser abort contract", async (t) => {
  let parserSignal;
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    parseTimeoutMs: 10,
    async parseBytes({ signal }) {
      parserSignal = signal;
      await new Promise((resolve) => {
        signal.addEventListener("abort", resolve, { once: true });
      });
      return {
        documents: [{ title: "Too late", pageContent: "late result" }],
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const response = await fetch(`${baseUrl}/v1/parse?filename=slow.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-deadline-1",
    },
    body: "slow",
  });

  assert.equal(response.status, 503);
  assert.equal(parserSignal.aborted, true);
});

test("the production parser worker is physically terminated at the deadline", async (t) => {
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    parseTimeoutMs: 1,
    parseBytes: parseDocumentBytesInWorker,
  });
  const baseUrl = await listen(handler, t);
  const response = await fetch(`${baseUrl}/v1/parse?filename=worker.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-worker-deadline-1",
    },
    body: "worker boundary",
  });

  assert.equal(response.status, 503);
});

test("parser worker admission is bounded and queued calls honor abort", async () => {
  const controllers = [
    new AbortController(),
    new AbortController(),
    new AbortController(),
  ];
  const parses = controllers.map((controller, index) =>
    parseDocumentBytesInWorker({
      bytes: Buffer.from(`queued worker ${index}`),
      filename: `queued-${index}.txt`,
      mediaType: "text/plain",
      signal: controller.signal,
      maxWorkers: 1,
    })
  );

  assert.deepEqual(getParserWorkerState(1), {
    active: 1,
    queued: 2,
    limit: 1,
  });
  for (const controller of controllers) controller.abort();
  const settled = await Promise.allSettled(parses);
  assert.equal(
    settled.every(
      (result) =>
        result.status === "rejected" && result.reason?.name === "AbortError"
    ),
    true
  );
  assert.deepEqual(getParserWorkerState(1), {
    active: 0,
    queued: 0,
    limit: 1,
  });
});

test("parser worker enforces the extracted-text limit before decoding", async () => {
  await assert.rejects(
    parseDocumentBytesInWorker({
      bytes: Buffer.from("too large"),
      filename: "limited.txt",
      mediaType: "text/plain",
      maxExtractedTextBytes: 4,
      maxWorkers: 1,
    }),
    { name: "InvalidCollectorTextError", statusCode: 422 }
  );
});

test("collector bounds the serialized success payload before sending it", async (t) => {
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    maxResponseBytes: 256,
    async parseBytes() {
      return {
        documents: [
          {
            title: "Escaped",
            pageContent: "\\".repeat(160),
          },
        ],
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const response = await fetch(`${baseUrl}/v1/parse?filename=escaped.txt`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${PEER_TOKEN}`,
      "content-type": "text/plain",
      "x-commonplace-correlation-id": "express-request-response-limit-1",
    },
    body: "small",
  });

  assert.equal(response.status, 422);
});

test("collector JSON preflight matches serialization without allocating the payload", () => {
  const payload = {
    plain: "text",
    escaped: "\"\\\b\t\n\f\r\u0000",
    unicode: "é漢😀\ud800",
    array: [true, false, null, 42],
  };
  assert.equal(
    measureJsonBytes(payload),
    Buffer.byteLength(JSON.stringify(payload))
  );
  assert.equal(measureJsonBytes(payload, 8) > 8, true);
});

test("CollectorApi requires explicit discovery and sends exact bytes with peer authentication", async (t) => {
  assert.throws(
    () => new CollectorApi({ baseUrl: "", peerToken: PEER_TOKEN }),
    (error) =>
      error instanceof CollectorApiConfigurationError &&
      error.code === "COLLECTOR_URL_MISSING"
  );
  assert.throws(
    () =>
      new CollectorApi({
        baseUrl: "http://collector.internal",
        peerToken: "",
      }),
    (error) =>
      error instanceof CollectorApiConfigurationError &&
      error.code === "COLLECTOR_PEER_TOKEN_MISSING"
  );
  assert.throws(
    () =>
      new CollectorApi({
        baseUrl: "http://collector.internal",
        peerToken: "set-a-random-secret-with-at-least-32-characters",
      }),
    (error) =>
      error instanceof CollectorApiConfigurationError &&
      error.code === "COLLECTOR_PEER_TOKEN_MISSING"
  );

  const expectedBytes = Buffer.from([0x66, 0x6b, 0x37, 0x00, 0xff]);
  const handler = createCollectorRequestHandler({
    peerToken: PEER_TOKEN,
    async parseBytes(input) {
      assert.deepEqual(input.bytes, expectedBytes);
      assert.equal(input.filename, "boundary.bin");
      assert.equal(input.mediaType, "application/octet-stream");
      return {
        documents: [{ title: "Boundary", pageContent: "parsed bytes" }],
        sourceFacts: { byteLength: input.bytes.length },
      };
    },
  });
  const baseUrl = await listen(handler, t);
  const client = new CollectorApi({ baseUrl, peerToken: PEER_TOKEN });

  const result = await client.parseBytes({
    bytes: expectedBytes,
    filename: "boundary.bin",
    mediaType: "application/octet-stream",
    correlationId: "express-request-0002",
  });

  assert.equal(client.baseUrl, baseUrl);
  assert.deepEqual(result, {
    correlationId: "express-request-0002",
    documents: [{ title: "Boundary", pageContent: "parsed bytes" }],
    sourceFacts: { byteLength: 5 },
  });
  await assert.rejects(
    client.parseBytes({
      bytes: expectedBytes,
      filename: "../shared-hotdir/boundary.bin",
      mediaType: "application/octet-stream",
      correlationId: "express-request-0002",
    }),
    { code: "COLLECTOR_FILENAME_INVALID" }
  );
});

test("the first parser slice is honest about its text-only support", async () => {
  const parsed = await parseDocumentBytes({
    bytes: Buffer.from("first collector slice"),
    filename: "slice.txt",
    mediaType: "text/plain; charset=utf-8",
  });
  assert.deepEqual(parsed, {
    documents: [
      {
        title: "slice.txt",
        pageContent: "first collector slice",
        wordCount: 3,
      },
    ],
    sourceFacts: {
      parser: "commonplace-text-v1",
      mediaType: "text/plain",
      byteLength: 21,
    },
  });

  await assert.rejects(
    parseDocumentBytes({
      bytes: Buffer.from([0xff]),
      filename: "slice.pdf",
      mediaType: "application/pdf",
    }),
    { name: "UnsupportedCollectorMediaTypeError", statusCode: 415 }
  );
  assert.equal(countWords(" one\t two\nthree\u3000four "), 4);
  assert.equal(countWords(" \t\n\u3000"), 0);
});

test("Express-derived scope and correlation reach IngestPipeline without collector authority", async () => {
  const calls = [];
  const request = {
    id: "express-request-0003",
    headers: {
      "x-commonplace-correlation-id": "browser-forged-correlation",
      "x-commonplace-tenant": "browser-forged-tenant",
    },
    body: {
      tenant: "browser-forged-tenant",
      workspaceId: "browser-forged-workspace",
    },
  };
  const collectorApi = {
    async parseBytes(input) {
      assert.deepEqual(Object.keys(input).sort(), [
        "bytes",
        "correlationId",
        "filename",
        "mediaType",
      ]);
      assert.equal(input.correlationId, request.id);
      return {
        correlationId: input.correlationId,
        tenant: "collector-forged-tenant",
        workspaceId: "collector-forged-workspace",
        documents: [
          {
            id: "collector-document-1",
            title: "Collector passage",
            pageContent: "The collector parsed this exact passage.",
            url: "file:///collector/private/hotdir/upload.txt",
            docAuthor: "Source Author",
            docSource: "uploaded text",
            token_count_estimate: 9,
          },
        ],
        sourceFacts: {
          parser: "commonplace-text-v1",
          tenant: "collector-forged-tenant",
        },
      };
    },
  };
  const boundary = createCollectorIngestBoundary({
    collectorApi,
    async resolveScope(input) {
      assert.equal(input.request, request);
      assert.equal(input.workspaceId, "workspace-42");
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch(input) {
        calls.push(input);
        return [
          {
            item: { id: "item-1" },
            correlationId: input.correlationId,
            idempotencyKey: input.idempotencyKey,
            documentIndex: input.documentBindings[0].index,
            documentDigest: input.documentBindings[0].digest,
          },
        ];
      },
    },
  });

  const result = await boundary.ingestUpload({
    request,
    workspaceId: "workspace-42",
    bytes: Buffer.from("upload bytes"),
    filename: "upload.txt",
    mediaType: "text/plain",
    source: "upload://workspace-42/upload.txt",
    tags: ["research"],
  });

  const idempotencyKey = calls[0].idempotencyKey;
  const documentBinding = calls[0].documentBindings[0];
  assert.match(idempotencyKey, /^collector:sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(result, {
    correlationId: "express-request-0003",
    idempotencyKey,
    scopeRef: "project:commonplace",
    receipts: [
      {
        item: { id: "item-1" },
        correlationId: "express-request-0003",
        idempotencyKey,
        documentIndex: 0,
        documentDigest: documentBinding.digest,
      },
    ],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].scope, SCOPE);
  assert.equal(calls[0].correlationId, request.id);
  assert.equal(calls[0].idempotencyKey, idempotencyKey);
  assert.deepEqual(calls[0].documentBindings, [documentBinding]);
  assert.deepEqual(calls[0].inputs, [
    {
      title: "Collector passage",
      text: "The collector parsed this exact passage.",
      kind: "doc",
      tags: [
        "research",
        "collector:peer",
      ],
      source: "upload://workspace-42/upload.txt",
    },
  ]);
  assert.deepEqual(calls[0].provenance.upload, {
    filename: "upload.txt",
    mediaType: "text/plain",
    source: "upload://workspace-42/upload.txt",
  });
  assert.equal(
    Object.hasOwn(calls[0].provenance.documents[0], "url"),
    false
  );
  assert.equal(calls[0].provenance.documents[0].docAuthor, "Source Author");
  assert.equal(
    calls[0].provenance.documents[0].documentDigest,
    documentBinding.digest
  );
  assert.deepEqual(calls[0].provenance.serviceFacts, {
    parser: "commonplace-text-v1",
    mediaType: null,
    byteLength: null,
    pageCount: null,
  });
  assert.equal(Object.hasOwn(calls[0].scope, "collector"), false);
});

test("an admitted scope for a different workspace fails before collector access", async () => {
  let collectorCalls = 0;
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes() {
        collectorCalls += 1;
        return { documents: [] };
      },
    },
    async resolveScope() {
      return { ...SCOPE, workspaceId: "different-workspace" };
    },
    ingestPipeline: {
      async ingestBatch() {
        throw new Error("ingest should not run");
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-0008" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("bytes"),
      filename: "scope.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/scope.txt",
    }),
    { code: "COLLECTOR_SCOPE_WORKSPACE_MISMATCH" }
  );
  assert.equal(collectorCalls, 0);
});

test("correlation fallback is generated server-side and ignores browser headers", () => {
  const generated = deriveExpressCorrelationId(
    {
      headers: {
        "x-commonplace-correlation-id": "browser-forged-correlation",
      },
    },
    () => "server-generated-request-0004"
  );
  assert.equal(generated, "server-generated-request-0004");
});

test("collector unavailability is retryable and cannot produce a partial ingest receipt", async () => {
  let ingestCalls = 0;
  const collectorApi = new CollectorApi({
    baseUrl: "http://collector.invalid",
    peerToken: PEER_TOKEN,
    async fetchImpl() {
      throw new Error("connect ECONNREFUSED");
    },
  });
  const boundary = createCollectorIngestBoundary({
    collectorApi,
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch() {
        ingestCalls += 1;
        return [];
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-0005" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("not parsed"),
      filename: "unavailable.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/unavailable.txt",
    }),
    (error) =>
      error.code === "COLLECTOR_UNAVAILABLE" && error.retryable === true
  );
  assert.equal(ingestCalls, 0);
});

test("a mismatched collector correlation fails closed", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    async fetchImpl() {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            success: true,
            correlationId: "different-request-9999",
            documents: [{ title: "Wrong request", pageContent: "content" }],
          };
        },
      };
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "correlation.txt",
      mediaType: "text/plain",
      correlationId: "express-request-0006",
    }),
    { code: "COLLECTOR_CORRELATION_MISMATCH" }
  );
});

test("an invalid 5xx peer response remains a retryable outage", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    async fetchImpl() {
      return {
        ok: false,
        status: 503,
        async json() {
          throw new SyntaxError("not json");
        },
      };
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "outage.txt",
      mediaType: "text/plain",
      correlationId: "express-request-0009",
    }),
    (error) =>
      error.code === "COLLECTOR_PEER_INVALID_RESPONSE" &&
      error.retryable === true
  );
});

test("a truncated 2xx peer response remains a retryable outage", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    async fetchImpl() {
      return {
        ok: true,
        status: 200,
        body: null,
        async json() {
          throw new SyntaxError("terminated response body");
        },
      };
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "truncated.txt",
      mediaType: "text/plain",
      correlationId: "express-request-0011",
    }),
    (error) =>
      error.code === "COLLECTOR_PEER_INVALID_RESPONSE" &&
      error.retryable === true
  );
});

test("collector response bytes are bounded before JSON is retained", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    maxResponseBytes: 32,
    async fetchImpl() {
      return new Response(
        JSON.stringify({
          success: true,
          correlationId: "express-request-0012",
          documents: [{ title: "Large", pageContent: "x".repeat(100) }],
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "large.txt",
      mediaType: "text/plain",
      correlationId: "express-request-0012",
    }),
    (error) =>
      error.code === "COLLECTOR_RESPONSE_TOO_LARGE" &&
      error.retryable === false
  );
});

test("a malformed deterministic refusal is not retryable", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    async fetchImpl() {
      return {
        ok: false,
        status: 401,
        body: null,
        async json() {
          throw new SyntaxError("not json");
        },
      };
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "refused.txt",
      mediaType: "text/plain",
      correlationId: "express-request-refused-1",
    }),
    (error) =>
      error.code === "COLLECTOR_REFUSAL_INVALID_RESPONSE" &&
      error.retryable === false &&
      error.status === 401
  );
});

test("collector timeout remains active while the response body is streaming", async () => {
  const client = new CollectorApi({
    baseUrl: "https://collector.example.test",
    peerToken: PEER_TOKEN,
    timeoutMs: 10,
    async fetchImpl(_url, { signal }) {
      return {
        ok: true,
        status: 200,
        json() {
          return new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                const error = new Error("response body aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true }
            );
          });
        },
      };
    },
  });

  await assert.rejects(
    client.parseBytes({
      bytes: Buffer.from("content"),
      filename: "slow.txt",
      mediaType: "text/plain",
      correlationId: "express-request-0010",
    }),
    (error) => error.code === "COLLECTOR_TIMEOUT" && error.retryable === true
  );
});

test("invalid parser output is rejected before IngestPipeline", async () => {
  let ingestCalls = 0;
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes({ correlationId }) {
        return {
          correlationId,
          documents: [{ title: "Empty", pageContent: "   " }],
          sourceFacts: {},
        };
      },
    },
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch() {
        ingestCalls += 1;
        return [];
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-0007" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("bytes"),
      filename: "empty.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/empty.txt",
    }),
    { code: "COLLECTOR_DOCUMENT_INVALID" }
  );
  assert.equal(ingestCalls, 0);
});

test("IngestPipeline must return one idempotency-bound receipt per document", async () => {
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes({ correlationId }) {
        return {
          correlationId,
          documents: [{ title: "Receipt", pageContent: "receipt proof" }],
          sourceFacts: {},
        };
      },
    },
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch() {
        return [];
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-0013" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("receipt proof"),
      filename: "receipt.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/receipt.txt",
    }),
    { code: "COLLECTOR_INGEST_RECEIPT_INVALID" }
  );
});

test("upload retries keep one content identity while correlation remains per attempt", async () => {
  const calls = [];
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes({ correlationId }) {
        return {
          correlationId,
          documents: [{ title: "Stable", pageContent: "stable passage" }],
          sourceFacts: {},
        };
      },
    },
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch(input) {
        calls.push(input);
        return input.documentBindings.map((binding) => ({
          item: { id: "item-stable" },
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          documentIndex: binding.index,
          documentDigest: binding.digest,
        }));
      },
    },
  });
  const upload = {
    workspaceId: "workspace-42",
    bytes: Buffer.from("stable upload bytes"),
    filename: "stable.txt",
    mediaType: "text/plain",
    source: "upload://workspace-42/stable.txt",
  };

  const first = await boundary.ingestUpload({
    ...upload,
    request: { id: "express-request-retry-0001" },
  });
  const second = await boundary.ingestUpload({
    ...upload,
    request: { id: "express-request-retry-0002" },
  });
  const retagged = await boundary.ingestUpload({
    ...upload,
    request: { id: "express-request-retry-0003" },
    tags: ["different-semantics"],
  });

  assert.notEqual(first.correlationId, second.correlationId);
  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.notEqual(first.idempotencyKey, retagged.idempotencyKey);
  assert.equal(
    calls[0].documentBindings[0].digest,
    calls[1].documentBindings[0].digest
  );
});

test("IngestPipeline receipts bind uniquely to every parsed document", async () => {
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes({ correlationId }) {
        return {
          correlationId,
          documents: [
            { title: "First", pageContent: "first passage" },
            { title: "Second", pageContent: "second passage" },
          ],
          sourceFacts: {},
        };
      },
    },
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch(input) {
        return input.documentBindings.map((binding) => ({
          item: { id: "duplicate-item" },
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          documentIndex: binding.index,
          documentDigest: binding.digest,
        }));
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-receipts-0001" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("two passages"),
      filename: "two.txt",
      mediaType: "text/plain",
      source: "upload://workspace-42/two.txt",
    }),
    { code: "COLLECTOR_INGEST_RECEIPT_INVALID" }
  );
});

test("upload source is derived from admitted workspace and filename", async () => {
  let collectorCalls = 0;
  const boundary = createCollectorIngestBoundary({
    collectorApi: {
      async parseBytes() {
        collectorCalls += 1;
        return { documents: [] };
      },
    },
    async resolveScope() {
      return SCOPE;
    },
    ingestPipeline: {
      async ingestBatch() {
        return [];
      },
    },
  });

  await assert.rejects(
    boundary.ingestUpload({
      request: { id: "express-request-0014" },
      workspaceId: "workspace-42",
      bytes: Buffer.from("content"),
      filename: "source.txt",
      mediaType: "text/plain",
      source: "file:///collector/private/source.txt",
    }),
    { code: "COLLECTOR_SOURCE_MISMATCH" }
  );
  assert.equal(collectorCalls, 0);
});

async function listen(handler, t) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
