"use strict";

const { VectorDatabase } = require("../base");
const {
  ContentTransportError,
  createContentTransport,
} = require("./content-transport");
const { createEnvironmentScopeResolver } = require("./scope-resolver");

const MAX_TOP_N = 200;

class RustyRed extends VectorDatabase {
  #resolveScope;
  #transport;
  #transportFactory;

  constructor({
    transport = null,
    transportFactory = createContentTransport,
    scopeResolver = createEnvironmentScopeResolver(),
  } = {}) {
    super();
    this.#transport = transport;
    this.#transportFactory = transportFactory;
    this.#resolveScope = scopeResolver;
  }

  get name() {
    return "RustyRed";
  }

  async connect() {
    return { client: await this.#getTransport() };
  }

  async heartbeat() {
    return (await this.#getTransport()).heartbeat();
  }

  async totalVectors() {
    throw new Error(
      "RustyRed totalVectors requires an identity-scoped workspace list; global content enumeration is refused."
    );
  }

  async namespaceCount(namespace = null) {
    const scope = await this.#resolveScope(namespace);
    return (await this.#getTransport()).count(scope);
  }

  async namespace(client, namespace = null) {
    const scope = await this.#resolveScope(namespace);
    const transport = client ?? (await this.#getTransport());
    return {
      namespace,
      scopeRef: scope.scopeRef,
      count: await transport.count(scope),
    };
  }

  async hasNamespace(namespace = null) {
    try {
      await this.#resolveScope(namespace);
      return true;
    } catch (error) {
      if (
        error?.code === "CONTENT_SCOPE_NOT_ADMITTED" ||
        error?.code === "CONTENT_NAMESPACE_MISSING"
      ) {
        return false;
      }
      throw error;
    }
  }

  async namespaceExists(_client, namespace = null) {
    return this.hasNamespace(namespace);
  }

  async deleteVectorsInNamespace(client, namespace = null) {
    void client;
    void namespace;
    throw refusedDestructiveOperation(
      "deleteVectorsInNamespace",
      "RustyRed namespace deletion is refused; workspace content must be removed by explicit item operations."
    );
  }

  async addDocumentToNamespace(
    namespace,
    documentData = {},
    fullFilePath = null,
    _skipCache = false
  ) {
    try {
      const scope = await this.#resolveScope(namespace);
      const document = normalizeDocument(documentData, fullFilePath);
      if (!document.text) {
        return { vectorized: false, error: "Document text is required." };
      }

      const item = await (await this.#getTransport()).ingest(scope, document);
      return {
        vectorized: true,
        error: null,
        itemId: item.id,
        collections: item.collections ?? [],
      };
    } catch (error) {
      this.logger("addDocumentToNamespace", error.message);
      return { vectorized: false, error: error.message };
    }
  }

  async deleteDocumentFromNamespace(namespace, docId) {
    const scope = await this.#resolveScope(namespace);
    await (await this.#getTransport()).deleteDocument(scope, docId);
    return true;
  }

  async performSimilaritySearch({
    namespace = null,
    input = "",
    similarityThreshold = null,
    topN = 4,
    filterIdentifiers = [],
  }) {
    if (!namespace || !input) {
      throw new Error("Invalid request to performSimilaritySearch.");
    }
    assertSupportedSimilarityThreshold(similarityThreshold);

    const scope = await this.#resolveScope(namespace);
    const result = await (await this.#getTransport()).retrieve(scope, {
      input,
      topN: normalizeTopN(topN),
    });
    const excluded = new Set(filterIdentifiers);
    const rawProvenance = result.provenance ?? [];
    const provenance = rawProvenance.filter(({ item }) => {
      return (
        typeof item?.bodyText === "string" &&
        item.bodyText.length > 0 &&
        !excluded.has(item.id) &&
        !excluded.has(item.source)
      );
    });
    const visibleMeasurement = measureVisibleExpansion(provenance);

    return {
      contextTexts: provenance.map(({ item }) => item.bodyText),
      sources: this.curateSources(
        provenance.map(({ item, score, arms }) => ({
          id: item.id,
          title: item.title,
          text: item.bodyText,
          source: item.source,
          classification: item.classification,
          collections: item.collections,
          path: item.path,
          score,
          arms,
          scopeRef: scope.scopeRef,
        }))
      ),
      message: false,
      measurement: {
        ...(result.pprExpansion ?? {}),
        ...visibleMeasurement,
        filteredPassageCount: rawProvenance.length - provenance.length,
      },
    };
  }

  async similarityResponse() {
    throw new Error(
      "RustyRed accepts plain-text scoped retrieval through performSimilaritySearch; raw query vectors are refused."
    );
  }

  async "namespace-stats"({ namespace = null } = {}) {
    const { client } = await this.connect();
    return this.namespace(client, namespace);
  }

  async "delete-namespace"({ namespace = null } = {}) {
    void namespace;
    throw refusedDestructiveOperation(
      "delete-namespace",
      "RustyRed namespace deletion is refused; use explicit content deletion instead."
    );
  }

  async reset() {
    throw refusedDestructiveOperation(
      "reset",
      "RustyRed reset is refused; global content wipes are outside the adapter contract."
    );
  }

  curateSources(sources = []) {
    return sources
      .filter((source) => source && typeof source === "object")
      .map((source) => ({ ...source }));
  }

  async #getTransport() {
    if (!this.#transport) {
      this.#transport = this.#transportFactory();
    }
    return this.#transport;
  }
}

function measureVisibleExpansion(provenance) {
  let returnedFlatCandidateCount = 0;
  let returnedPprCandidateCount = 0;
  let returnedPprOnlyCandidateCount = 0;
  for (const entry of provenance) {
    const arms = new Set(Array.isArray(entry?.arms) ? entry.arms : []);
    const flat = arms.has("vector") || arms.has("lexical");
    const ppr = arms.has("graph");
    if (flat) returnedFlatCandidateCount += 1;
    if (ppr) returnedPprCandidateCount += 1;
    if (ppr && !flat) returnedPprOnlyCandidateCount += 1;
  }
  return {
    returnedPassageCount: provenance.length,
    returnedFlatCandidateCount,
    returnedPprCandidateCount,
    returnedPprOnlyCandidateCount,
  };
}

function normalizeDocument(documentData, fullFilePath) {
  const { pageContent, docId, title, tags, source, sourceRef, source_ref, ...metadata } = documentData;
  const normalizedSourceRef = normalizeSourceRef(
    sourceRef ??
      source_ref ??
      metadata?.metadata?.sourceRef ??
      metadata?.metadata?.source_ref ??
      metadata.sourceRef ??
      metadata.source_ref
  );
  const resolvedTitle = pickFirstNonEmptyString(
    title,
    metadata?.metadata?.title,
    metadata.title,
    docId,
    normalizedSourceRef?.externalId,
    "Untitled document"
  );
  const resolvedSource = pickFirstNonEmptyString(
    source,
    metadata?.metadata?.source,
    metadata?.metadata?.url,
    metadata.source,
    metadata.url,
    fullFilePath,
    normalizedSourceRef?.source,
    docId ? `anythingllm-doc:${docId}` : null
  );
  const normalizedTags = Array.isArray(tags) ? [...tags] : [];
  if (docId) {
    normalizedTags.push(`anythingllm-doc:${docId}`);
  }

  const normalized = {
    title: resolvedTitle,
    text: typeof pageContent === "string" ? pageContent.trim() : "",
    kind: "doc",
    tags: [...new Set(normalizedTags)],
    source: resolvedSource,
  };
  if (normalizedSourceRef) {
    normalized.sourceRef = normalizedSourceRef;
  }
  return normalized;
}

function normalizeTopN(topN) {
  const normalized = Number(topN);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1;
  }
  return Math.min(MAX_TOP_N, Math.floor(normalized));
}

function assertSupportedSimilarityThreshold(value) {
  if (value === null || value === undefined) {
    return;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new ContentTransportError(
      "Similarity threshold must be a finite number between zero and one.",
      {
        code: "CONTENT_SIMILARITY_THRESHOLD_INVALID",
        details: { similarityThreshold: value },
      }
    );
  }
  if (value === 0) return;
  throw new ContentTransportError(
    "RustyRed retrieval returns fused RRF scores, so cosine-style similarity thresholds are not supported.",
    {
      code: "CONTENT_SIMILARITY_THRESHOLD_UNSUPPORTED",
      details: { similarityThreshold: value, scoreLane: "rrf" },
    }
  );
}

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function normalizeSourceRef(sourceRef) {
  if (!sourceRef || typeof sourceRef !== "object") {
    return null;
  }
  const source = pickFirstNonEmptyString(sourceRef.source);
  const externalId = pickFirstNonEmptyString(
    sourceRef.externalId,
    sourceRef.external_id
  );
  if (!source || !externalId) {
    return null;
  }
  return { source, externalId };
}

function refusedDestructiveOperation(operation, message) {
  return new ContentTransportError(message, {
    code: "CONTENT_OPERATION_REFUSED",
    details: { operation },
  });
}

module.exports = {
  assertSupportedSimilarityThreshold,
  RustyRed,
  measureVisibleExpansion,
  normalizeDocument,
  normalizeSourceRef,
  normalizeTopN,
  MAX_TOP_N,
};
