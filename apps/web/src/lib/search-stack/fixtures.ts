// SOURCING: none. Typed test-only fixture data shaped like the wire contract.

/**
 * TEST-ONLY fixture source for the search stack.
 *
 * This module is imported by `*.test.ts` and `*.test.tsx` files and by nothing
 * else. `apps/web/CLAUDE.md` forbids mock data in any file the production
 * bundle ships and forbids mock-mode URL flags by name, so the client
 * (`./client.ts`) posts real GraphQL documents unconditionally and there is no
 * flag that can route a shipped surface here. A test asserts that no module
 * outside `*.test.*` imports this file.
 *
 * The shapes below mirror `@commonplace/block-view-contracts/search-stack`
 * exactly, so a test that renders from a fixture exercises the same parsing and
 * projection code that a live response does.
 */

import {
  MAX_ASPECTS,
  type AspectNode,
  type FindLane,
  type FindRequest,
  type FindResponse,
  type FindResult,
  type FindScopeKind,
  type SaveUrlReceipt,
  type ScatterResponse,
} from '@commonplace/block-view-contracts/search-stack';

/**
 * The Page-scope fixture document text. The byte ranges below address this
 * string, so `byteRangeToTextTarget` round-trips against it exactly the way it
 * will against a real indexed text property.
 */
export const FIXTURE_PAGE_TEXT =
  'The membrane admits results by budget, not by threshold. ' +
  'A budget is a promise about attention: the membrane admits what fits and defers the rest, ' +
  'so an honest empty answer beats a padded one.';

export const FIXTURE_PAGE_NODE_ID = 'cp-fixture-page';

const PAGE_RESULT: FindResult = {
  hit: {
    doc: FIXTURE_PAGE_NODE_ID,
    // "budget" as it appears in the second sentence of FIXTURE_PAGE_TEXT.
    byteRange: { start: 59, end: 65 },
    lane: 'EXACT',
    scope: { kind: 'PAGE', nodeId: FIXTURE_PAGE_NODE_ID },
    snippet: 'threshold. A budget is a promise about attention',
    title: 'The membrane admits by budget',
    source: 'https://commonplace.local/fixtures/membrane',
  },
  score: 0.97,
  relation: 'KNOWN',
  edges: [],
};

const SESSION_RESULT: FindResult = {
  hit: {
    doc: 'cp-fixture-session-note',
    byteRange: { start: 0, end: 14 },
    lane: 'SEMANTIC',
    scope: { kind: 'SESSION', nodeIds: [FIXTURE_PAGE_NODE_ID, 'cp-fixture-session-note'] },
    snippet: 'Attention budget notes from this session',
    title: 'Attention budget',
    source: 'https://commonplace.local/fixtures/session-note',
  },
  score: 0.81,
  relation: 'EXTENDS',
  edges: [
    {
      id: 'edge-fixture-extends',
      fromId: 'cp-fixture-session-note',
      toId: FIXTURE_PAGE_NODE_ID,
      type: 'extends',
      confidence: 0.72,
    },
  ],
};

/** The saved item F4 files and F1 surfaces once the scope widens to Corpus. */
export const FIXTURE_SAVED_ITEM_ID = 'cp-fixture-saved-item';
export const FIXTURE_COLLECTION_NAME = 'Reading, unfiled';

const CORPUS_RESULT: FindResult = {
  hit: {
    doc: FIXTURE_SAVED_ITEM_ID,
    byteRange: { start: 12, end: 18 },
    lane: 'LEXICAL',
    scope: { kind: 'CORPUS' },
    snippet: 'Saved page: budget discipline in retrieval systems',
    title: 'Budget discipline in retrieval systems',
    source: 'https://example.com/budget-discipline',
  },
  score: 0.68,
  relation: 'CONTRADICTS',
  edges: [
    {
      id: 'edge-fixture-contradicts',
      fromId: FIXTURE_SAVED_ITEM_ID,
      toId: FIXTURE_PAGE_NODE_ID,
      type: 'contradicts',
      confidence: 0.55,
    },
  ],
};

const WEB_RESULT: FindResult = {
  hit: {
    doc: 'cp-fixture-web',
    byteRange: { start: 0, end: 6 },
    lane: 'STRUCTURAL',
    scope: { kind: 'WEB' },
    snippet: 'budget-aware retrieval, an open frontier',
    title: 'Budget-aware retrieval',
    source: 'https://example.org/budget-aware-retrieval',
  },
  score: 0.44,
  relation: 'ORPHAN',
  edges: [],
};

const BY_SCOPE: Record<FindScopeKind, readonly FindResult[]> = {
  PAGE: [PAGE_RESULT],
  SESSION: [SESSION_RESULT],
  CORPUS: [CORPUS_RESULT],
  WEB: [WEB_RESULT],
};

/**
 * Answer a find request from the fixture corpus. Honors the requested scopes
 * and lanes exactly the way the executor does, so a lane chip toggled off
 * removes only that lane's hits and a narrower scope really is narrower.
 */
export function fixtureFind(request: FindRequest): FindResponse {
  const scopeKinds = request.scopes.map((scope) => scope.kind);
  const laneFilter = new Set<FindLane>(request.lanes);
  const query = request.query.trim().toLowerCase();

  const results = scopeKinds
    .flatMap((kind) => BY_SCOPE[kind] ?? [])
    .filter((result) => laneFilter.has(result.hit.lane))
    .filter((result) => matchesQuery(result, query))
    .slice(0, Math.max(0, request.k));

  const lanes = Array.from(laneFilter).map((lane) => {
    const seeded = scopeKinds
      .flatMap((kind) => BY_SCOPE[kind] ?? [])
      .filter((result) => result.hit.lane === lane).length;
    return {
      lane,
      seeded,
      admitted: results.filter((result) => result.hit.lane === lane).length,
    };
  });

  return {
    query: request.query,
    results,
    lanes,
    scopesSearched: scopeKinds.map((kind) => kind.toLowerCase()),
    lambda: request.lambda,
    retrievalRef: `fixture-retrieval-${scopeKinds.join('-') || 'none'}`,
  };
}

function matchesQuery(result: FindResult, query: string): boolean {
  if (!query) return false;
  const haystack = `${result.hit.title ?? ''} ${result.hit.snippet ?? ''}`.toLowerCase();
  return query.split(/\s+/).some((term) => term.length > 0 && haystack.includes(term));
}

// ---------------------------------------------------------------------------
// Scatter (layer one)
// ---------------------------------------------------------------------------

/**
 * Three aspects over the same corpus. `budget` and `attention` share the page
 * document in their seed hits, which is the real evidence a shared-source edge
 * is drawn from; `frontier` shares nothing, so no edge should survive for it.
 */
export const FIXTURE_ASPECTS: readonly AspectNode[] = [
  {
    id: 'aspect-budget',
    label: 'Budget discipline',
    seedHits: [PAGE_RESULT.hit, CORPUS_RESULT.hit],
    relation: 'KNOWN',
    edges: [
      { target: 'aspect-attention', weight: 0.71 },
      { target: 'aspect-frontier', weight: 0.22 },
    ],
  },
  {
    id: 'aspect-attention',
    label: 'Attention as a promise',
    seedHits: [PAGE_RESULT.hit, SESSION_RESULT.hit],
    relation: 'EXTENDS',
    edges: [{ target: 'aspect-budget', weight: 0.71 }],
  },
  {
    id: 'aspect-frontier',
    label: 'Open frontier',
    seedHits: [WEB_RESULT.hit],
    relation: 'ORPHAN',
    edges: [{ target: 'aspect-budget', weight: 0.22 }],
  },
];

export const FIXTURE_SCATTER_RETRIEVAL_REF = 'fixture-scatter-1';

export function fixtureScatter(query: string, lambda: number): ScatterResponse {
  return {
    query,
    aspects: FIXTURE_ASPECTS.slice(0, MAX_ASPECTS),
    lambda,
    labeler: 'deterministic',
    scopesSearched: ['corpus'],
    scene: { sceneId: 'fixture-scene-1', package: { id: 'fixture-scene-1' } },
    sceneRefusal: null,
    scatterRef: FIXTURE_SCATTER_RETRIEVAL_REF,
  };
}

/** An expand response: two sub-aspects drawn from the expanded aspect. */
export function fixtureExpand(query: string, aspect: string, lambda: number): ScatterResponse {
  return {
    query,
    aspects: [
      {
        id: `${aspect}-a`,
        label: 'Deferral, not refusal',
        seedHits: [CORPUS_RESULT.hit],
        relation: 'EXTENDS',
        edges: [],
      },
      {
        id: `${aspect}-b`,
        label: 'Budget as a promise',
        seedHits: [PAGE_RESULT.hit],
        relation: 'KNOWN',
        edges: [],
      },
    ],
    lambda,
    labeler: 'deterministic',
    scopesSearched: ['corpus'],
    scene: { sceneId: 'fixture-scene-2', package: { id: 'fixture-scene-2' } },
    sceneRefusal: null,
    expandedFrom: aspect,
    scatterRef: 'fixture-scatter-2',
  };
}

/** Every result orphan, every edge absent: the zero-graph-connection case. */
export function fixtureOrphanFind(query: string): FindResponse {
  return {
    query,
    results: [PAGE_RESULT, SESSION_RESULT, CORPUS_RESULT, WEB_RESULT].map((result) => ({
      ...result,
      relation: 'ORPHAN' as const,
      edges: [],
    })),
    lanes: [],
    scopesSearched: ['corpus', 'web'],
    lambda: 0.5,
    retrievalRef: 'fixture-orphan-retrieval',
  };
}

/** A connected find response: the corpus result contradicts the page result. */
export function fixtureAspectFind(query: string, lambda: number): FindResponse {
  return {
    query,
    results: [PAGE_RESULT, CORPUS_RESULT, SESSION_RESULT],
    lanes: [
      { lane: 'EXACT', seeded: 2, admitted: 1 },
      { lane: 'SEMANTIC', seeded: 1, admitted: 1 },
      { lane: 'STRUCTURAL', seeded: 1, admitted: 0, degradedReason: 'web lane timed out' },
    ],
    scopesSearched: ['corpus', 'web'],
    lambda,
    retrievalRef: `fixture-aspect-${query.replace(/\s+/g, '-').toLowerCase()}`,
  };
}

/** The receipt F4's confirmation reads its collection name from. */
export function fixtureSaveUrl(url: string): SaveUrlReceipt {
  return {
    itemId: FIXTURE_SAVED_ITEM_ID,
    collectionId: 'cp-fixture-collection',
    collectionName: FIXTURE_COLLECTION_NAME,
    title: 'Budget discipline in retrieval systems',
    url,
  };
}
