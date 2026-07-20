'use client';

// SOURCING: d3 via @/lib/constellation-layout (the SAME seeded force layout the
// full-size scene uses, so the thumbnail is the map, not a second drawing).
// The marks are hand-rolled SVG: a visited-state thumbnail of a constellation
// is a domain surface no minimap library models.

/**
 * The docked constellation map (HANDOFF-SEARCH-CONSTELLATION D4).
 *
 * When a result node opens in the co-browse stage, the constellation does not
 * disappear: it docks into the session rail as a thumbnail. The thumbnail is
 * the same graph, laid out by the same seeded simulation with the same query
 * seed, so a node sits where the person last saw it sit.
 *
 * Visited nodes are marked. The mark is shape-and-fill, not colour alone, and
 * every node keeps an accessible name that says whether it has been opened, so
 * the visit state is readable without seeing it.
 */

import { useMemo } from 'react';
import type { ConstellationPayload } from '@commonplace/block-view-contracts/search-stack';
import { layoutConstellation, type ConstellationLayoutNode } from '@/lib/constellation-layout';
import styles from './serp.module.css';

const MAP_WIDTH = 220;
const MAP_HEIGHT = 130;
const NODE_RADIUS = 7;

export function DockedMap({
  payload,
  visited,
  onReopen,
}: {
  payload: ConstellationPayload;
  visited: readonly string[];
  /** Reopen full size. The session continues; nothing is reset. */
  onReopen: () => void;
}) {
  const visitedSet = useMemo(() => new Set(visited), [visited]);

  const layout = useMemo(() => {
    const nodes: ConstellationLayoutNode[] = [
      ...payload.nodes.map((node) => ({ id: node.id, kind: 'result' as const })),
      ...payload.memoryNodes.map((node) => ({ id: node.id, kind: 'memory' as const })),
    ];
    return layoutConstellation({
      query: payload.meta.query,
      nodes,
      edges: payload.edges.map((edge) => ({ source: edge.source, target: edge.target })),
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
    });
  }, [payload]);

  const visitedCount = payload.nodes.filter((node) => visitedSet.has(node.id)).length;

  return (
    <button
      type="button"
      className={styles.dockedMap}
      onClick={onReopen}
      aria-label={`Reopen the constellation for ${payload.meta.query}. ${visitedCount} of ${payload.nodes.length} results opened.`}
      data-testid="docked-map"
    >
      <svg
        className={styles.dockedMapCanvas}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        {payload.edges.map((edge) => {
          const from = layout.get(edge.source);
          const to = layout.get(edge.target);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.source}-${edge.target}-${edge.reason.type}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={styles.dockedMapEdge}
            />
          );
        })}
        {payload.nodes.map((node) => {
          const point = layout.get(node.id);
          if (!point) return null;
          const opened = visitedSet.has(node.id);
          return (
            <circle
              key={node.id}
              cx={point.x}
              cy={point.y}
              r={NODE_RADIUS}
              className={styles.dockedMapNode}
              data-node-id={node.id}
              data-visited={opened ? 'true' : 'false'}
              data-relation={node.relation}
            />
          );
        })}
      </svg>
      <span className={styles.dockedMapCaption}>
        {payload.meta.query}
        <span className={styles.dockedMapCount}>
          {visitedCount}/{payload.nodes.length} opened
        </span>
      </span>
      {/* The visit state as text, so the thumbnail is not the only way to read it. */}
      <ul className={styles.srOnlyList}>
        {payload.nodes.map((node) => (
          <li key={node.id} data-node-id={node.id} data-visited={visitedSet.has(node.id) ? 'true' : 'false'}>
            {node.title}: {visitedSet.has(node.id) ? 'opened' : 'not opened'}
          </li>
        ))}
      </ul>
    </button>
  );
}
