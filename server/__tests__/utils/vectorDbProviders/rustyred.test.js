"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { RustyRed, normalizeDocument } = require("../../../utils/vectorDbProviders/rustyred");
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

test("GraphQL transport forwards scope headers and never places the API key in the body", async () => {
  const requests = [];
  const transport = new CommonplaceGraphqlTransport({
    endpoint: "https://content.example.test/graphql",
    apiKey: "secret-api-key",
    unsafeAllowUnscopedScopeFallback: true,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        async json() {
          return { data: { items: [{ id: "item-1" }] } };
        },
      };
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

test("document normalization refuses to invent user content", () => {
  assert.deepEqual(normalizeDocument({}, null), {
    title: "Untitled document",
    text: "",
    kind: "doc",
    tags: [],
    source: null,
  });
});
