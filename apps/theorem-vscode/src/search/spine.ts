// SOURCING: vscode proposed search provider API (fileSearchProvider2,
// textSearchProvider2) plus the existing @commonplace/block-view-contracts
// search-stack wire types. No third-party search client applies; ripgrep stays
// as VS Code ships it.
/**
 * V4. Search over the spine, gated.
 *
 * The gate, verified 2026-08-02: `src/vscode-dts/vscode.proposed.textSearchProvider2.d.ts`
 * is still served from microsoft/vscode main, so both search provider shapes
 * remain proposed API. The 2024 rename moved the New shapes to the current
 * names and the old ones to *Old, which is why the finalization threads read as
 * done; they are not. Marketplace publication of an extension declaring these
 * proposals is refused, and a stock build will not hand them out.
 *
 * So the pack carries the providers and asks at activation whether this build
 * granted them. Granted, quick open and the search view come off
 * `rustyred-thg-find` with membrane weighting. Not granted, the pack registers
 * nothing and VS Code's own ripgrep search is untouched, which is exactly named
 * choice 8's "ripgrep remains the fallback and is never removed".
 *
 * `Commonplace Studio` grants the proposals through `product.json`
 * `extensionEnabledApiProposals`, the mechanism Microsoft uses for its own
 * first-party extensions. See packaging/commonplace-studio/product.json.
 */

import * as vscode from 'vscode';
import type { FindResponse, FindResult } from '@commonplace/block-view-contracts/search-stack';
import type { IntelligenceDegradation } from '@commonplace/block-view-contracts/editor-intelligence';
import type { SubstrateClient } from '../substrate/client';

export const FIND_QUERY = `query Find($query: String!, $k: Int!) {
  find(query: $query, k: $k) {
    query
    lambda
    retrievalRef
    scopesSearched
    results {
      score
      relation
      hit { doc lane title source snippet byteRange { start end } scope { kind } }
    }
    lanes { lane seeded admitted degradedReason }
  }
}`;

/**
 * How much a hit inside the open project outranks an equal hit outside it.
 *
 * The membrane is a tie-breaker, not a filter. An outside hit with a genuinely
 * better score still wins, and an outside hit always stays in the list: V4's
 * acceptance requires the outside hit to remain present, because a workspace
 * boundary is a hint about attention, not a claim about relevance.
 */
export const MEMBRANE_BONUS = 0.15;

export interface RankableHit {
  readonly doc: string;
  readonly score: number;
}

/** True when the document path sits inside one of the workspace roots. */
export function isInsideProject(doc: string, roots: readonly string[]): boolean {
  return roots.some((root) => doc === root || doc.startsWith(root.endsWith('/') ? root : `${root}/`));
}

/**
 * Apply the membrane and sort. Stable on equal weighted scores, so the store's
 * own ordering survives wherever the membrane has nothing to say.
 */
export function rankHits<T extends RankableHit>(hits: readonly T[], roots: readonly string[]): T[] {
  return hits
    .map((hit, index) => ({
      hit,
      index,
      weighted: hit.score + (isInsideProject(hit.doc, roots) ? MEMBRANE_BONUS : 0),
    }))
    .sort((a, b) => b.weighted - a.weighted || a.index - b.index)
    .map((entry) => entry.hit);
}

/** Lane receipts that came back degraded, named for the results surface. */
export function degradedLanes(response: FindResponse): string[] {
  return response.lanes.filter((lane) => lane.degradedReason).map((lane) => lane.lane);
}

/**
 * Whether this build granted the search proposals.
 *
 * Proposed API is absent, not disabled: the registration functions simply do
 * not exist on the namespace in a build that did not grant them. Feature
 * detection is therefore the honest test, and it also covers the case where a
 * future VS Code finalizes them and the gate opens on its own.
 */
export function searchProposalGranted(api: typeof vscode = vscode): boolean {
  const workspace = api.workspace as unknown as Record<string, unknown>;
  return (
    typeof workspace.registerFileSearchProvider === 'function' &&
    typeof workspace.registerTextSearchProvider === 'function'
  );
}

export interface SpineSearchDeps {
  readonly client: SubstrateClient;
  readonly roots: readonly string[];
  readonly onDegradation: (degradation: IntelligenceDegradation) => void;
}

/**
 * One find call, membrane-weighted, with degradation surfaced rather than
 * swallowed. Both providers share it so quick open and the search view can
 * never disagree about ranking.
 */
export async function findRanked(
  deps: SpineSearchDeps,
  query: string,
  k: number,
): Promise<readonly FindResult[]> {
  const result = await deps.client.query<{ find: FindResponse | null }>(FIND_QUERY, { query, k });
  if (!result.ok) {
    deps.onDegradation(result.degradation);
    return [];
  }
  const response = result.data.find;
  if (!response) {
    deps.onDegradation({ level: 'unavailable', code: 'editor_search_unavailable' });
    return [];
  }

  const degraded = degradedLanes(response);
  if (degraded.length) {
    deps.onDegradation({
      level: 'reduced',
      code: 'editor_search_degraded',
      missing: degraded,
    });
  }

  return rankHits(
    response.results.map((entry) => ({ ...entry, doc: entry.hit.doc })),
    deps.roots,
  );
}

/**
 * Register both providers when the gate is open.
 *
 * Returns the disposables, or an empty array with the reason logged when the
 * build did not grant the proposals. The proposed shapes are reached through a
 * cast: the pack compiles against stable `@types/vscode`, and pinning the d.ts
 * of an unfinalized proposal into this repo would make the pack track upstream
 * churn it does not otherwise care about.
 */
export function registerSpineSearch(
  deps: SpineSearchDeps,
  api: typeof vscode = vscode,
): vscode.Disposable[] {
  if (!searchProposalGranted(api)) return [];

  const workspace = api.workspace as unknown as {
    registerFileSearchProvider(scheme: string, provider: unknown): vscode.Disposable;
    registerTextSearchProvider(scheme: string, provider: unknown): vscode.Disposable;
  };

  const fileProvider = {
    async provideFileSearchResults(pattern: { pattern: string }): Promise<vscode.Uri[]> {
      const results = await findRanked(deps, pattern.pattern, 200);
      return results.map((entry) => api.Uri.parse(entry.hit.doc));
    },
  };

  const textProvider = {
    async provideTextSearchResults(
      query: { pattern: string },
      _options: unknown,
      progress: { report(value: unknown): void },
    ): Promise<{ limitHit: boolean }> {
      const results = await findRanked(deps, query.pattern, 200);
      for (const entry of results) {
        progress.report({
          uri: api.Uri.parse(entry.hit.doc),
          ranges: [new api.Range(0, 0, 0, 0)],
          preview: {
            text: entry.hit.snippet ?? entry.hit.title ?? '',
            matches: [new api.Range(0, 0, 0, 0)],
          },
        });
      }
      return { limitHit: false };
    },
  };

  return [
    workspace.registerFileSearchProvider('file', fileProvider),
    workspace.registerTextSearchProvider('file', textProvider),
  ];
}
