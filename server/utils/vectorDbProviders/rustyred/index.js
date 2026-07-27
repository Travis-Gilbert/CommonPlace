"use strict";

const { VectorDatabase } = require("../base");
const { createContentTransport } = require("./content-transport");
const { createEnvironmentScopeResolver } = require("./scope-resolver");

class RustyRed extends VectorDatabase {
  #resolveScope;
  #transport;

  constructor({
    transport = createContentTransport(),
    scopeResolver = createEnvironmentScopeResolver(),
  } = {}) {
    super();
    this.#transport = transport;
    this.#resolveScope = scopeResolver;
  }

  get name() {
    return "RustyRed";
  }

  async connect() {
    return { client: this.#transport };
  }

  async heartbeat() {
    return this.#transport.heartbeat();
  }

  async totalVectors() {
    throw new Error(
      "RustyRed totalVectors requires an identity-scoped workspace list; global content enumeration is refused."
    );
  }

  async namespaceCount(namespace = null) {
    const scope = await this.#resolveScope(namespace);
    return this.#transport.count(scope);
  }

  async namespace(client, namespace = null) {
    const scope = await this.#resolveScope(namespace);
    return {
      namespace,
      scopeRef: scope.scopeRef,
      count: await client.count(scope),
    };
  }

  async hasNamespace(namespace = null) {
    try {
      const scope = await this.#resolveScope(namespace);
      return (await this.#transport.count(scope)) > 0;
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
    const scope = await this.#resolveScope(namespace);
    await client.deleteNamespace(scope);
    return true;
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

      const item = await this.#transport.ingest(scope, document);
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
    await this.#transport.deleteDocument(scope, docId);
    return true;
  }

  async performSimilaritySearch({
    namespace = null,
    input = "",
    topN = 4,
    filterIdentifiers = [],
  }) {
    if (!namespace || !input) {
      throw new Error("Invalid request to performSimilaritySearch.");
    }

    const scope = await this.#resolveScope(namespace);
    const result = await this.#transport.retrieve(scope, {
      input,
      topN: Math.max(1, topN),
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
    const { client } = await this.connect();
    await this.deleteVectorsInNamespace(client, namespace);
    return { message: `Namespace ${namespace} was deleted.` };
  }

  async reset() {
    return this.#transport.reset();
  }

  curateSources(sources = []) {
    return sources
      .filter((source) => source && typeof source === "object")
      .map((source) => ({ ...source }));
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
  const { pageContent, docId, title, tags, source, ...metadata } = documentData;
  const resolvedTitle =
    title ?? metadata?.metadata?.title ?? metadata.title ?? docId ?? "Untitled document";
  const resolvedSource =
    source ??
    metadata?.metadata?.source ??
    metadata?.metadata?.url ??
    metadata.url ??
    fullFilePath ??
    (docId ? `anythingllm-doc:${docId}` : null);
  const normalizedTags = Array.isArray(tags) ? [...tags] : [];
  if (docId) {
    normalizedTags.push(`anythingllm-doc:${docId}`);
  }

  return {
    title: resolvedTitle,
    text: typeof pageContent === "string" ? pageContent.trim() : "",
    kind: "doc",
    tags: [...new Set(normalizedTags)],
    source: resolvedSource,
  };
}

module.exports = { RustyRed, measureVisibleExpansion, normalizeDocument };
