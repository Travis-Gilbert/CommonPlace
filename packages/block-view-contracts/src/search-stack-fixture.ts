// SOURCING: none. Pure wire fixtures, no upstream component applies.
/**
 * Constellation fixtures for HANDOFF-SEARCH-CONSTELLATION D2, D3 and D5.
 *
 * Mirrors the style of `scene-package-fixture.ts`: exported constants typed
 * against the wire contract, no factories, no randomness. Every fixture is a
 * literal so the renderer tests can assert exact strings.
 */

import type { ScenePackageV2 } from './scene-package';
import { SCENE_PACKAGE_SCHEMA_VERSION } from './scene-package';
import type {
  ConstellationEdge,
  ConstellationMemoryNode,
  ConstellationNode,
  ConstellationPayload,
  ConstellationQueryMeta,
  ConstellationState,
} from './search-stack';

const META: ConstellationQueryMeta = {
  query: 'perovskite tandem cell degradation',
  subgraphRef: 'subgraph:web-search-graph/aa41f0',
  tokensAdmitted: 4_180,
  tokensDeferred: 11_640,
  degradedProviders: [],
};

/** Eight admitted result nodes, the hard cap for this surface. */
export const CONSTELLATION_RESULT_NODES: readonly ConstellationNode[] = [
  {
    id: 'r1',
    url: 'https://www.nature.com/articles/s41560-024-01512-y',
    title: 'Operational stability of perovskite tandem cells',
    favicon: 'https://www.nature.com/favicon.ico',
    description: 'Field data on 1,000 hour damp heat exposure.',
    admittedRank: 1,
    relation: 'EXTENDS',
  },
  {
    id: 'r2',
    url: 'https://www.science.org/doi/10.1126/science.adk1000',
    title: 'Halide segregation under illumination',
    favicon: 'https://www.science.org/favicon.ico',
    description: 'Ion migration drives the wide bandgap subcell loss.',
    admittedRank: 2,
    relation: 'KNOWN',
  },
  {
    id: 'r3',
    url: 'https://pubs.rsc.org/en/content/articlelanding/2024/ee/d4ee00120f',
    title: 'Encapsulation strategies for tandem modules',
    favicon: 'https://pubs.rsc.org/favicon.ico',
    description: 'Edge seal chemistry against moisture ingress.',
    admittedRank: 3,
    relation: 'EXTENDS',
  },
  {
    id: 'r4',
    url: 'https://www.nrel.gov/pv/cell-efficiency.html',
    title: 'NREL best research cell efficiency chart',
    favicon: 'https://www.nrel.gov/favicon.ico',
    description: 'Certified record trajectory for tandem architectures.',
    admittedRank: 4,
    relation: 'KNOWN',
  },
  {
    id: 'r5',
    url: 'https://joule.cell.com/fulltext/S2542-4351(24)00133-7',
    title: 'Thermal cycling failure modes',
    favicon: 'https://joule.cell.com/favicon.ico',
    description: 'Delamination at the recombination junction.',
    admittedRank: 5,
    relation: 'CONTRADICTS',
  },
  {
    id: 'r6',
    url: 'https://www.pvel.com/scorecard',
    title: 'PVEL module reliability scorecard',
    favicon: 'https://www.pvel.com/favicon.ico',
    description: 'Independent accelerated stress test results.',
    admittedRank: 6,
    relation: 'KNOWN',
  },
  {
    id: 'r7',
    url: 'https://www.osti.gov/biblio/2318844',
    title: 'Accelerated ageing protocol for tandems',
    favicon: 'https://www.osti.gov/favicon.ico',
    description: 'Proposed ISO style protocol for stack level ageing.',
    admittedRank: 7,
    relation: 'EXTENDS',
  },
  {
    id: 'r8',
    url: 'https://arxiv.org/abs/2403.09912',
    title: 'Machine learned screening of passivation layers',
    favicon: 'https://arxiv.org/favicon.ico',
    description: 'No shared source with the rest of the admitted set.',
    admittedRank: 8,
    relation: 'ORPHAN',
  },
];

/** Two gold memory nodes, the hard cap for this surface. */
export const CONSTELLATION_MEMORY_NODES: readonly ConstellationMemoryNode[] = [
  {
    id: 'm1',
    atomRef: 'atom:note/2026-06-perovskite-damp-heat',
    title: 'Damp heat notes',
    connectionExplanation: 'you captured three notes on this entity in June',
  },
  {
    id: 'm2',
    atomRef: 'atom:claim/tandem-ageing-protocol',
    title: 'Ageing protocol claim',
    connectionExplanation: 'you saved this protocol as a claim in April and cited it twice',
  },
];

/** One edge per `EdgeReasonType`, so every reason renders in at least one test. */
export const CONSTELLATION_EDGES: readonly ConstellationEdge[] = [
  {
    source: 'r1',
    target: 'r2',
    reason: {
      type: 'field_fact_intersect',
      text: 'Both report the same 1,000 hour damp heat threshold for the wide bandgap subcell.',
      evidenceRefs: ['fact:damp-heat-1000h', 'fact:subcell-wide-bandgap'],
    },
  },
  {
    source: 'r2',
    target: 'r3',
    reason: {
      type: 'citation',
      text: 'The encapsulation paper cites the halide segregation result as its motivating failure mode.',
      evidenceRefs: ['citation:d4ee00120f-to-adk1000'],
    },
  },
  {
    source: 'r3',
    target: 'r4',
    reason: {
      type: 'shared_source',
      text: 'Both draw their efficiency baseline from the NREL certified record dataset.',
      evidenceRefs: ['source:nrel-cell-efficiency'],
    },
  },
  {
    source: 'r4',
    target: 'r5',
    reason: {
      type: 'shared_author',
      text: 'Kojima appears as an author on both the record chart notes and the thermal cycling study.',
      evidenceRefs: ['author:kojima-a'],
    },
  },
  {
    source: 'r5',
    target: 'r6',
    reason: {
      type: 'graph_edge',
      text: 'Your graph already links the thermal cycling study to the PVEL scorecard as evidence.',
      evidenceRefs: ['edge:thermal-cycling-supports-scorecard'],
    },
  },
  {
    source: 'm1',
    target: 'r1',
    reason: {
      type: 'memory_exact_tier',
      text: 'Exact tier match: your damp heat notes name the same 1,000 hour threshold this article reports.',
      evidenceRefs: ['memory:atom/note-2026-06', 'fact:damp-heat-1000h'],
    },
  },
  {
    source: 'm2',
    target: 'r7',
    reason: {
      type: 'memory_exact_tier',
      text: 'Exact tier match: your saved ageing protocol claim is the protocol this preprint proposes.',
      evidenceRefs: ['memory:atom/claim-tandem-ageing'],
    },
  },
];

/** Full constellation: eight results, two gold nodes, every reason type. */
export const CONSTELLATION_FULL_FIXTURE: ConstellationPayload = {
  nodes: CONSTELLATION_RESULT_NODES,
  edges: CONSTELLATION_EDGES,
  memoryNodes: CONSTELLATION_MEMORY_NODES,
  meta: META,
};

/** Honest zero edge constellation: admitted results that do not relate. */
export const CONSTELLATION_ZERO_EDGE_FIXTURE: ConstellationPayload = {
  nodes: CONSTELLATION_RESULT_NODES.slice(0, 4).map((node) => ({ ...node, relation: 'ORPHAN' })),
  edges: [],
  memoryNodes: [],
  meta: { ...META, query: 'unrelated survey of tandem vendors' },
};

/** Two gold memory nodes with explained edges into the result set. */
export const CONSTELLATION_TWO_MEMORY_FIXTURE: ConstellationPayload = CONSTELLATION_FULL_FIXTURE;

/** A tenant whose graph does not intersect the results. No gold nodes at all. */
export const CONSTELLATION_NO_MEMORY_FIXTURE: ConstellationPayload = {
  nodes: CONSTELLATION_RESULT_NODES,
  edges: CONSTELLATION_EDGES.filter((edge) => edge.reason.type !== 'memory_exact_tier'),
  memoryNodes: [],
  meta: META,
};

/** Over the caps on both axes. The payload boundary must trim it to 8 and 2. */
export const CONSTELLATION_OVERSIZED_FIXTURE: ConstellationPayload = {
  nodes: [
    ...CONSTELLATION_RESULT_NODES,
    {
      id: 'r9',
      url: 'https://example.org/overflow-nine',
      title: 'Ninth admitted result',
      admittedRank: 9,
      relation: 'KNOWN',
    },
    {
      id: 'r10',
      url: 'https://example.org/overflow-ten',
      title: 'Tenth admitted result',
      admittedRank: 10,
      relation: 'KNOWN',
    },
    {
      id: 'r11',
      url: 'https://example.org/overflow-eleven',
      title: 'Eleventh admitted result',
      admittedRank: 11,
      relation: 'ORPHAN',
    },
  ],
  edges: [
    ...CONSTELLATION_EDGES,
    {
      source: 'r9',
      target: 'r10',
      reason: {
        type: 'shared_source',
        text: 'Edge between two nodes that the cap removes.',
        evidenceRefs: ['source:overflow'],
      },
    },
    {
      source: 'm3',
      target: 'r1',
      reason: {
        type: 'memory_exact_tier',
        text: 'Edge from a memory node that the cap removes.',
        evidenceRefs: ['memory:atom/overflow'],
      },
    },
  ],
  memoryNodes: [
    ...CONSTELLATION_MEMORY_NODES,
    {
      id: 'm3',
      atomRef: 'atom:note/overflow-three',
      title: 'Third memory node',
      connectionExplanation: 'you captured one note on this entity in March',
    },
    {
      id: 'm4',
      atomRef: 'atom:note/overflow-four',
      title: 'Fourth memory node',
      connectionExplanation: 'you captured one note on this entity in May',
    },
  ],
  meta: META,
};

/** Partial: two providers degraded, payload still admitted. */
export const CONSTELLATION_PARTIAL_PAYLOAD: ConstellationPayload = {
  nodes: CONSTELLATION_RESULT_NODES.slice(0, 5),
  edges: CONSTELLATION_EDGES.slice(0, 3),
  memoryNodes: CONSTELLATION_MEMORY_NODES.slice(0, 1),
  meta: {
    ...META,
    degradedProviders: ['brave', 'crossref'],
  },
};

/** One fixture per D5 state. */
export const CONSTELLATION_STATE_FIXTURES: {
  readonly loading: ConstellationState;
  readonly empty: ConstellationState;
  readonly partial: ConstellationState;
  readonly error: ConstellationState;
  readonly success: ConstellationState;
} = {
  loading: {
    kind: 'loading',
    narration: 'Widening from this page to the corpus, then to the web.',
  },
  empty: {
    kind: 'empty',
    reason: 'The membrane admitted nothing for this query at the current lambda.',
  },
  partial: {
    kind: 'partial',
    payload: CONSTELLATION_PARTIAL_PAYLOAD,
    degradedNotes: [
      'brave returned no results within the deadline.',
      'crossref refused the citation lookup with a rate limit.',
    ],
  },
  error: {
    kind: 'error',
    cause: 'web_search_graph refused the subgraph handle: the retrieval reference expired.',
  },
  success: {
    kind: 'success',
    payload: CONSTELLATION_FULL_FIXTURE,
  },
};

/**
 * Scene package carrying the constellation under `provenance.constellation`.
 * Geometry lives in atoms and relations, annotation lives in the payload.
 */
export const CONSTELLATION_SCENE_PACKAGE_FIXTURE: ScenePackageV2 = {
  schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
  version: SCENE_PACKAGE_SCHEMA_VERSION,
  id: 'scene-constellation-1',
  manifestRef: 'manifest:scene-constellation-1',
  atoms: [
    ...CONSTELLATION_RESULT_NODES.map((node) => ({
      id: node.id,
      kind: 'result',
      label: node.title,
      position: { x: 0, y: 0, space: 'graph' as const },
      weight: 1 - node.admittedRank / 10,
      lifecycle: 'present' as const,
      metadata: { url: node.url, relation: node.relation },
    })),
    ...CONSTELLATION_MEMORY_NODES.map((node) => ({
      id: node.id,
      kind: 'memory',
      label: node.title,
      position: { x: 0, y: 0, space: 'graph' as const },
      lifecycle: 'present' as const,
      metadata: { atomRef: node.atomRef },
    })),
  ],
  relations: CONSTELLATION_EDGES.map((edge) => ({
    id: `${edge.source}-${edge.target}`,
    sourceId: edge.source,
    targetId: edge.target,
    kind: edge.reason.type,
    lifecycle: 'present' as const,
  })),
  projection: { id: 'force_graph' },
  chrome: { id: 'commonplace_scene_host' },
  provenance: {
    title: 'Search constellation fixture',
    source: 'HANDOFF-SEARCH-CONSTELLATION',
    constellation: CONSTELLATION_STATE_FIXTURES.success,
  },
};
