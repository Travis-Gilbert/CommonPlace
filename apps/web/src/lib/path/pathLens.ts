// SOURCING: none — pure logic, no upstream component applies
/**
 * PL2 Path lens helpers: chain set for dimming, edge keys along the chain,
 * and readout formatting. Reuses focusDimming tiers; the "neighbor" set is
 * the ancestor/blocker chain instead of 1-hop adjacency.
 */

import type { PathResult } from './pathTo';
import { formatPathReadout } from './pathTo';

export { formatPathReadout };

/** Ground (non-chain) alpha when Path lens is active. Lower than default dim. */
export const PATH_GROUND_OPACITY = 0.12;

/** Ink alpha for nodes on the selected path chain. */
export const PATH_CHAIN_OPACITY = 1.0;

/** Build the set of node ids that stay lit under the Path lens. */
export function pathChainIdSet(result: PathResult | null): Set<string> {
  if (!result) return new Set();
  return new Set(result.chain.map((n) => n.id));
}

/**
 * Consecutive chain pairs as `${a}|${b}` keys for edge weighting.
 * Order follows topological depth as returned by pathTo.
 */
export function pathChainEdgeKeys(result: PathResult | null): Set<string> {
  const keys = new Set<string>();
  if (!result || result.chain.length < 2) return keys;
  for (let i = 0; i < result.chain.length - 1; i += 1) {
    const a = result.chain[i]?.id;
    const b = result.chain[i + 1]?.id;
    if (!a || !b) continue;
    keys.add(`${a}|${b}`);
    keys.add(`${b}|${a}`);
  }
  return keys;
}

/** Opacity for a point under Path lens: chain lit, everything else to ground. */
export function pathOpacityFor(
  pointId: string,
  focusedId: string | null,
  chainIds: Set<string>,
): number {
  if (!focusedId) return PATH_CHAIN_OPACITY;
  if (pointId === focusedId || chainIds.has(pointId)) return PATH_CHAIN_OPACITY;
  return PATH_GROUND_OPACITY;
}

/** Size multiplier: focused tip largest, chain elevated, ground quiet. */
export function pathSizeMultFor(
  pointId: string,
  focusedId: string | null,
  chainIds: Set<string>,
): number {
  if (!focusedId) return 2.4;
  if (pointId === focusedId) return 4.6;
  if (chainIds.has(pointId)) return 3.2;
  return 1.8;
}
