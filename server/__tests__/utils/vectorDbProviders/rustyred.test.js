"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RustyRed,
  MAX_TOP_N,
  normalizeDocument,
  normalizeTopN,
} = require("../../../utils/vectorDbProviders/rustyred");
const {
  CommonplaceGraphqlTransport,
  UnsupportedContentOperationError,
} = require("../../../utils/vectorDbProviders/rustyred/content-transport");
const {
  createEnvironmentScopeResolver,
} = require("../../../utils/vectorDbProviders/rustyred/scope-resolver");

const SCOPE = Object.freeze({
  tenant: "Travis-Gilbert",
  workspaceId: "workspace-42",
  scopeRef: "project:commonplace",
});

test("namespace resolution preserves admitted tenant casing", async () => {
  const resolveScope = createEnvironmentScopeResolver(
    JSON.stringify({ research: SCOPE })
  );

  assert.deepEqual(await resolveScope("research"), SCOPE);
  await assert.rejects(resolveScope("Research"), {
    code: "CONTENT_SCOPE_NOT_ADMITTED",
  });
});

test("document ingest delegates to the content transport without embedding in JavaScript", async () => {
  const calls = [];
  const transport = {
    async ingest(scope, document) {
      calls.push({ scope, document });
      return { id: "item-1", collections: ["collection-auto"] };
    },
  };
  const adapter = new RustyRed({
    transport,
    scopeResolver: async () => SCOPE,
  });

  const result = await adapter.addDocumentToNamespace(
    "research",
    {
      pageContent: "A real passage parsed by the collector.",
      docId: "doc-7",
      title: "Collector passage",
      source: "https://example.test/source",
    },
    "/collector/hotdir/doc-7.json"
  );

  assert.deepEqual(result, {
    vectorized: true,
    error: null,
    itemId: "item-1",
    collections: ["collection-auto"],
  });
  assert.deepEqual(calls, [
    {
      scope: SCOPE,
      document: {
        title: "Collector passage",
        text: "A real passage parsed by the collector.",
        kind: "doc",
        tags: ["anythingllm-doc:doc-7"],
        source: "https://example.test/source",
      },
    },
  ]);
});

test("adapter construction does not eagerly require a content transport", async () => {
  let transportCreations = 0;
  const adapter = new RustyRed({
    transportFactory: () => {
      transportCreations += 1;
      return {
        async heartbeat() {
          return { heartbeat: 42 };
        },
      };
    },
    scopeResolver: async () => SCOPE,
  });

  assert.equal(transportCreations, 0);
  assert.deepEqual(await adapter.heartbeat(), { heartbeat: 42 });
  assert.equal(transportCreations, 1);
});

test("retrieval returns passages, provenance sources, and the PPR measurement", async () => {
  const adapter = new RustyRed({
    scopeResolver: async () => SCOPE,
    transport: {
      async retrieve(scope, request) {
        assert.equal(scope, SCOPE);
        assert.deepEqual(request, { input: "graph recall", topN: 5 });
        return {
          provenance: [
            {
              score: 0.031,
              arms: ["graph"],
              item: {
                id: "item-hidden",
                title: "Hidden evidence",
                bodyText: "PPR reached this passage through a similarity bridge.",
                source: "fixture://hidden",
                classification: "research",
                collections: ["collection-auto"],
                path: "Research/Hidden evidence",
              },
            },
            {
              score: 0.002,
              arms: ["graph"],
              item: {
                id: "item-without-body",
                title: "Metadata only",
                bodyText: null,
                source: "fixture://metadata-only",
                classification: "research",
                collections: [],
                path: "Research/Metadata only",
              },
            },
          ],
          pprExpansion: {
            seedCount: 1,
            flatCandidateCount: 2,
            pprCandidateCount: 2,
            pprOnlyCandidateCount: 1,
          },
        };
      },
    },
  });

  const result = await adapter.performSimilaritySearch({
    namespace: "research",
    input: "graph recall",
    topN: 5,
  });

  assert.deepEqual(result.contextTexts, [
    "PPR reached this passage through a similarity bridge.",
  ]);
  assert.equal(result.sources[0].source, "fixture://hidden");
  assert.deepEqual(result.sources[0].arms, ["graph"]);
  assert.equal(result.sources[0].scopeRef, "project:commonplace");
  assert.equal(result.sources.length, result.contextTexts.length);
  assert.deepEqual(result.measurement, {
    seedCount: 1,
    flatCandidateCount: 2,
    pprCandidateCount: 2,
    pprOnlyCandidateCount: 1,
    returnedPassageCount: 1,
    returnedFlatCandidateCount: 0,
    returnedPprCandidateCount: 1,
    returnedPprOnlyCandidateCount: 1,
    filteredPassageCount: 1,
  });
  assert.equal(result.message, false);
});

test("adapter refuses cosine thresholds against fused RRF scores", async () => {
  let retrievals = 0;
  const adapter = new RustyRed({
    scopeResolver: async () => SCOPE,
    transport: {
      async retrieve() {
        retrievals += 1;
        return { provenance: [] };
      },
    },
  });

  for (const similarityThreshold of [0.8, 0.25]) {
    await assert.rejects(
      adapter.performSimilaritySearch({
        namespace: "research",
        input: "graph recall",
        similarityThreshold,
      }),
      {
        code: "CONTENT_SIMILARITY_THRESHOLD_UNSUPPORTED",
        details: { similarityThreshold, scoreLane: "rrf" },
      }
    );
  }
  assert.equal(retrievals, 0);
});

test("GraphQL transport forwards scope headers and never places the API key in the body", async () => {
  const requests = [];
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    unsafeAllowUnscopedScopeFallback: true,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ data: { itemCount: 1 } }));
    },
  });

  assert.equal(await transport.count(SCOPE), 1);
  assert.equal(requests[0].init.headers["x-commonplace-tenant"], "Travis-Gilbert");
  assert.equal(
    requests[0].init.headers["x-commonplace-workspace"],
    "workspace-42"
  );
  assert.equal(
    requests[0].init.headers["x-commonplace-scope-ref"],
    "project:commonplace"
  );
  assert.equal(requests[0].init.headers["x-api-key"], "secret-api-key");
  assert.equal(requests[0].init.body.includes("secret-api-key"), false);
  assert.match(requests[0].init.body, /itemCount/);
});

test("GraphQL transport preserves upstream 5xx retry semantics", async () => {
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    fetchImpl: async () =>
      new Response("temporarily unavailable", { status: 503 }),
  });

  await assert.rejects(transport.heartbeat(), {
    code: "CONTENT_HTTP_ERROR",
    retryable: true,
    status: 503,
    details: { status: 503 },
  });
});

test("GraphQL transport bounds response bytes before parsing JSON", async () => {
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    maxResponseBytes: 32,
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: { itemCount: 1 }, padding: "x".repeat(64) })),
  });

  await assert.rejects(transport.heartbeat(), {
    code: "CONTENT_RESPONSE_TOO_LARGE",
    status: 502,
  });
});

test("GraphQL ingest forwards the stable source reference to IngestPipeline", async () => {
  const requests = [];
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    unsafeAllowUnscopedScopeFallback: true,
    fetchImpl: async (_url, init) => {
      requests.push(init);
      return new Response(
        JSON.stringify({ data: { ingest: { id: "item-1" } } })
      );
    },
  });

  await transport.ingest(SCOPE, {
    title: "Collector passage",
    text: "Stable source identity",
    kind: "doc",
    tags: ["collector:peer"],
    source: "upload://workspace-42/source.txt",
    sourceRef: {
      source: "upload://workspace-42/source.txt",
      externalId: "workspace:workspace-42:sha256:digest",
    },
    provenance: {
      kind: "collector",
      correlationId: "express-request-ingest-0001",
      document: {
        index: 0,
        documentDigest: "sha256:digest",
        docAuthor: "Source Author",
      },
    },
  });

  const body = JSON.parse(requests[0].body);
  assert.deepEqual(body.variables.input.sourceRef, {
    source: "upload://workspace-42/source.txt",
    externalId: "workspace:workspace-42:sha256:digest",
  });
  assert.deepEqual(body.variables.input.provenance, {
    kind: "collector",
    correlationId: "express-request-ingest-0001",
    document: {
      index: 0,
      documentDigest: "sha256:digest",
      docAuthor: "Source Author",
    },
  });
});

test("GraphQL transport refuses scoped reads until the endpoint can enforce them", async () => {
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });

  await assert.rejects(transport.count(SCOPE), {
    code: "CONTENT_SCOPE_ENFORCEMENT_MISSING",
  });
});

test("GraphQL transport rejects malformed payload shapes", async () => {
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    unsafeAllowUnscopedScopeFallback: true,
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: { ask: null } })),
  });

  await assert.rejects(
    transport.retrieve(SCOPE, { input: "graph recall", topN: 2 }),
    {
      code: "CONTENT_RESPONSE_INVALID",
    }
  );
});

test("unsupported destructive operations refuse instead of reporting success", async () => {
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });

  await assert.rejects(transport.deleteDocument(SCOPE, "doc-1"), {
    name: UnsupportedContentOperationError.name,
    code: "UNSUPPORTED_CONTENT_OPERATION",
  });
  await assert.rejects(transport.deleteNamespace(SCOPE), {
    code: "UNSUPPORTED_CONTENT_OPERATION",
  });
  await assert.rejects(transport.reset(), {
    code: "UNSUPPORTED_CONTENT_OPERATION",
  });
});

test("adapter refuses destructive namespace and reset operations", async () => {
  const adapter = new RustyRed({
    transport: {
      async deleteNamespace() {
        throw new Error("deleteNamespace should not run");
      },
      async reset() {
        throw new Error("reset should not run");
      },
    },
    scopeResolver: async () => SCOPE,
  });

  await assert.rejects(adapter.deleteVectorsInNamespace({}, "research"), {
    code: "CONTENT_OPERATION_REFUSED",
  });
  await assert.rejects(adapter["delete-namespace"]({ namespace: "research" }), {
    code: "CONTENT_OPERATION_REFUSED",
  });
  await assert.rejects(adapter.reset(), {
    code: "CONTENT_OPERATION_REFUSED",
  });
});

test("namespace existence is scope-admission truth, not document-count truth", async () => {
  let countCalls = 0;
  const adapter = new RustyRed({
    transport: {
      async count() {
        countCalls += 1;
        return 0;
      },
    },
    scopeResolver: async () => SCOPE,
  });

  assert.equal(await adapter.hasNamespace("research"), true);
  assert.equal(countCalls, 0);
});

test("topN normalization floors finite values and clamps invalid inputs", () => {
  assert.equal(normalizeTopN(4.8), 4);
  assert.equal(normalizeTopN("3"), 3);
  assert.equal(normalizeTopN(0), 1);
  assert.equal(normalizeTopN("not-a-number"), 1);
  assert.equal(normalizeTopN(MAX_TOP_N + 17), MAX_TOP_N);
});

test("document normalization refuses to invent user content", () => {
  assert.deepEqual(normalizeDocument({}, null), {
    title: "Untitled document",
    text: "",
    kind: "doc",
    tags: [],
    source: null,
  });
});

test("document normalization preserves stable source identity and falls back from dead titles", () => {
  assert.deepEqual(
    normalizeDocument(
      {
        pageContent: "Collector body",
        title: "   ",
        docId: "doc-9",
        source_ref: {
          source: "upload://workspace-42/doc-9.md",
          external_id: "workspace:workspace-42:sha256:doc-9",
        },
      },
      null
    ),
    {
      title: "doc-9",
      text: "Collector body",
      kind: "doc",
      tags: ["anythingllm-doc:doc-9"],
      source: "upload://workspace-42/doc-9.md",
      sourceRef: {
        source: "upload://workspace-42/doc-9.md",
        externalId: "workspace:workspace-42:sha256:doc-9",
      },
    }
  );
});
