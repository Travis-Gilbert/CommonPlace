// SOURCING: none. Transport module; binds to the existing gql() seam in commonplace-graphql.ts.

/**
 * Search-stack client: the real front door for SPEC B7's `find`, `scatter` and
 * `expand` queries and the `saveUrl` mutation.
 *
 * Transport is the SAME seam every other CommonPlace surface uses:
 * `gql()` from `@/lib/commonplace-graphql`, which posts to the same-origin
 * proxy in a browser tab, to the loopback node in the Tauri desktop runtime,
 * and to Theorem directly on the server. Nothing new is invented here.
 *
 * There is no fixture mode and no mock-mode flag. Every function below posts a
 * real GraphQL document unconditionally. When the backend is unreachable these
 * throw, and the surfaces render their honest error state; they never fall back
 * to invented data.
 *
 * The documents name exactly what this client expects of `apps/commonplace-api`:
 *
 *   query find(query: String!, scopes: [FindScopeInput!], lanes: [String!],
 *              k: Int, lambda: Float): FindResponse!
 *     FindResponse  { query results lanes scopesSearched lambda retrievalRef }
 *     FindResult    { hit score relation edges }
 *     FindHit       { doc byteRange { start end } lane scope snippet title source }
 *     FindScope     { kind nodeId nodeIds }   (kind: page|session|corpus|web)
 *     LaneReceipt   { lane seeded admitted degradedReason }
 *     EdgeRef       { id fromId toId type confidence }
 *
 *   query scatter(query: String!, k: Int, lambda: Float): ScatterResponse!
 *   query expand(retrievalRef: String!, aspect: String!, k: Int,
 *                lambda: Float): ScatterResponse!
 *     ScatterResponse { query aspects lambda scene expandedFrom retrievalRef }
 *     AspectNode      { id label seedHits relation edges labeledBy }
 *     AspectEdge      { target weight }
 *     SceneRef        { sceneId url }
 *
 *   mutation saveUrl(url: String!): SaveUrlReceipt!
 *     SaveUrlReceipt { itemId collectionId collectionName title url }
 */

import { gql } from '@/lib/commonplace-graphql';
import type {
  AspectId,
  FindRequest,
  FindResponse,
  FindScope,
  SaveUrlReceipt,
  ScatterResponse,
} from '@commonplace/block-view-contracts/search-stack';

const HIT_FIELDS = `
  doc
  byteRange { start end }
  lane
  scope { kind nodeId nodeIds }
  snippet
  title
  source
`;

const FIND_FIELDS = `
  query
  results {
    hit { ${HIT_FIELDS} }
    score
    relation
    edges { id fromId toId type confidence }
  }
  lanes { lane seeded admitted degradedReason }
  scopesSearched
  lambda
  retrievalRef
`;

const SCATTER_FIELDS = `
  query
  aspects {
    id
    label
    relation
    labeledBy
    edges { target weight }
    seedHits { ${HIT_FIELDS} }
  }
  lambda
  scene { sceneId url }
  expandedFrom
  retrievalRef
`;

const SAVE_URL_FIELDS = 'itemId collectionId collectionName title url';

/** The scope union flattened into the GraphQL input shape (kind plus its ids). */
interface FindScopeInput {
  kind: FindScope['kind'];
  nodeId?: string;
  nodeIds?: readonly string[];
}

export function scopeToInput(scope: FindScope): FindScopeInput {
  switch (scope.kind) {
    case 'page':
      return { kind: 'page', nodeId: scope.nodeId };
    case 'session':
      return { kind: 'session', nodeIds: scope.nodeIds };
    default:
      return { kind: scope.kind };
  }
}

/**
 * Run a find. Throws on transport or GraphQL error so the overlay can render
 * its error state with the real cause rather than an empty result list that
 * reads as "nothing matched".
 */
export async function runFind(
  request: FindRequest,
  options: { signal?: AbortSignal } = {},
): Promise<FindResponse> {
  const data = await gql<{ find: FindResponse }>(
    `query($query:String!,$scopes:[FindScopeInput!],$lanes:[String!],$k:Int,$lambda:Float){
       find(query:$query, scopes:$scopes, lanes:$lanes, k:$k, lambda:$lambda){ ${FIND_FIELDS} }
     }`,
    {
      query: request.query,
      scopes: request.scopes.map(scopeToInput),
      lanes: request.lanes,
      k: request.k,
      lambda: request.lambda,
    },
    options,
  );
  return data.find;
}

export interface ScatterRequest {
  readonly query: string;
  /** Aspect count. The executor caps it at MAX_ASPECTS regardless. */
  readonly k: number;
  /** MMR convergence dial. 1.0 converges, 0.0 maximizes aspect spread. */
  readonly lambda: number;
}

/** Layer one (SPEC B5): scatter a query into at most MAX_ASPECTS aspects. */
export async function runScatter(
  request: ScatterRequest,
  options: { signal?: AbortSignal } = {},
): Promise<ScatterResponse> {
  const data = await gql<{ scatter: ScatterResponse }>(
    `query($query:String!,$k:Int,$lambda:Float){
       scatter(query:$query, k:$k, lambda:$lambda){ ${SCATTER_FIELDS} }
     }`,
    { query: request.query, k: request.k, lambda: request.lambda },
    options,
  );
  return data.scatter;
}

export interface ExpandRequest {
  /** The retrieval the aspect belongs to, so the executor re-scatters in place. */
  readonly retrievalRef: string;
  readonly aspect: AspectId;
  readonly k: number;
  readonly lambda: number;
}

/**
 * Re-scatter inside one aspect (SPEC B5 `expand`). The response names the
 * aspect it came from in `expandedFrom`, which is what lets the surface replace
 * only that region of the scene.
 */
export async function runExpand(
  request: ExpandRequest,
  options: { signal?: AbortSignal } = {},
): Promise<ScatterResponse> {
  const data = await gql<{ expand: ScatterResponse }>(
    `query($retrievalRef:String!,$aspect:String!,$k:Int,$lambda:Float){
       expand(retrievalRef:$retrievalRef, aspect:$aspect, k:$k, lambda:$lambda){ ${SCATTER_FIELDS} }
     }`,
    {
      retrievalRef: request.retrievalRef,
      aspect: request.aspect,
      k: request.k,
      lambda: request.lambda,
    },
    options,
  );
  return data.expand;
}

/**
 * File a URL into the workspace (SPEC F4). The receipt carries the REAL
 * collection name the ingest chose; the confirmation renders that name and
 * nothing else. A missing receipt is an error state, never a placeholder name.
 */
export async function saveUrl(url: string): Promise<SaveUrlReceipt> {
  const data = await gql<{ saveUrl: SaveUrlReceipt | null }>(
    `mutation($url:String!){ saveUrl(url:$url){ ${SAVE_URL_FIELDS} } }`,
    { url },
  );
  if (!data.saveUrl) throw new Error('saveUrl returned no receipt');
  return data.saveUrl;
}
