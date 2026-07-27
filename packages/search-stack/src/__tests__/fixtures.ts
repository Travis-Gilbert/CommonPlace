import {
  MAX_ASPECTS,
  type AspectNode,
  type FindResponse,
  type FindResult,
  type ScatterResponse,
} from '../contracts';

const PAGE: FindResult = {
  hit: {
    doc: 'page',
    byteRange: { start: 59, end: 65 },
    lane: 'EXACT',
    scope: { kind: 'PAGE', nodeId: 'page' },
    snippet: 'threshold. A budget is a promise about attention',
    title: 'The membrane admits by budget',
    source: 'https://commonplace.local/membrane',
  },
  score: 0.97,
  relation: 'KNOWN',
  edges: [],
};

const CORPUS: FindResult = {
  hit: {
    doc: 'corpus',
    byteRange: { start: 12, end: 18 },
    lane: 'LEXICAL',
    scope: { kind: 'CORPUS' },
    snippet: 'Saved page: budget discipline in retrieval systems',
    title: 'Budget discipline in retrieval systems',
    source: 'https://example.com/budget',
  },
  score: 0.68,
  relation: 'CONTRADICTS',
  edges: [
    {
      id: 'edge-contradicts',
      fromId: 'corpus',
      toId: 'page',
      type: 'contradicts',
    },
  ],
};

const SESSION: FindResult = {
  hit: {
    doc: 'session',
    byteRange: { start: 0, end: 9 },
    lane: 'SEMANTIC',
    scope: { kind: 'SESSION', nodeIds: ['page', 'session'] },
    snippet: 'attention budget notes from this session',
    title: 'Attention budget',
    source: 'https://commonplace.local/session',
  },
  score: 0.81,
  relation: 'EXTENDS',
  edges: [],
};

export const ASPECTS: readonly AspectNode[] = [
  {
    id: 'aspect-budget',
    label: 'Budget discipline',
    seedHits: [PAGE.hit, CORPUS.hit],
    relation: 'KNOWN',
    edges: [
      { target: 'aspect-attention', weight: 0.71 },
      { target: 'aspect-frontier', weight: 0.22 },
    ],
  },
  {
    id: 'aspect-attention',
    label: 'Attention as a promise',
    seedHits: [PAGE.hit, SESSION.hit],
    relation: 'EXTENDS',
    edges: [{ target: 'aspect-budget', weight: 0.71 }],
  },
  {
    id: 'aspect-frontier',
    label: 'Open frontier',
    seedHits: [
      {
        ...CORPUS.hit,
        doc: 'frontier',
        source: 'https://example.org/frontier',
      },
    ],
    relation: 'ORPHAN',
    edges: [{ target: 'aspect-budget', weight: 0.22 }],
  },
];

export function scatter(
  query = 'membrane',
  lambda = 0.5,
): ScatterResponse {
  return {
    query,
    aspects: ASPECTS.slice(0, MAX_ASPECTS),
    lambda,
    labeler: 'deterministic',
    scopesSearched: ['corpus'],
    scene: { sceneId: 'scene-1', package: {} },
    sceneRefusal: null,
    scatterRef: 'scatter-1',
  };
}

export function expansion(
  aspect = 'aspect-budget',
  lambda = 0.5,
): ScatterResponse {
  return {
    ...scatter('membrane', lambda),
    aspects: [
      {
        id: `${aspect}-a`,
        label: 'Deferral, not refusal',
        seedHits: [CORPUS.hit],
        relation: 'EXTENDS',
        edges: [],
      },
      {
        id: `${aspect}-b`,
        label: 'Budget as a promise',
        seedHits: [PAGE.hit],
        relation: 'KNOWN',
        edges: [],
      },
    ],
    expandedFrom: aspect,
    scatterRef: 'scatter-2',
  };
}

export function find(
  query = 'membrane budget',
  lambda = 0.5,
): FindResponse {
  return {
    query,
    results: [PAGE, CORPUS, SESSION],
    lanes: [
      { lane: 'EXACT', seeded: 1, admitted: 1 },
      {
        lane: 'STRUCTURAL',
        seeded: 1,
        admitted: 0,
        degradedReason: 'web lane timed out',
      },
    ],
    scopesSearched: ['corpus', 'web'],
    lambda,
    retrievalRef: 'find-1',
  };
}
