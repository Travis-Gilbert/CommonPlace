'use client';

// SOURCING: the same @commonplace/search-stack seeded layout as the full map.

import { useMemo } from 'react';
import {
  layoutConstellation,
  type ConstellationPayload,
} from '@commonplace/search-stack';

const MAP_WIDTH = 220;
const MAP_HEIGHT = 130;
const NODE_RADIUS = 7;

export function DockedMap({
  payload,
  visited,
  onReopen,
}: {
  readonly payload: ConstellationPayload;
  readonly visited: readonly string[];
  readonly onReopen: () => void;
}) {
  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const layout = useMemo(
    () => layoutConstellation({
      query: payload.meta.query,
      nodes: [
        ...payload.nodes.map((node) => ({
          id: node.id,
          kind: 'result' as const,
        })),
        ...payload.memoryNodes.map((node) => ({
          id: node.id,
          kind: 'memory' as const,
        })),
      ],
      edges: payload.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
    }),
    [payload],
  );
  const visitedCount = payload.nodes.filter((node) =>
    visitedSet.has(node.id)
  ).length;

  return (
    <button
      type="button"
      onClick={onReopen}
      aria-label={`Reopen the constellation for ${payload.meta.query}. ${visitedCount} of ${payload.nodes.length} results opened.`}
      data-testid="docked-map"
      className="grid w-full gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-2 text-left text-ij-ink hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent"
      style={{ transition: 'var(--rec-clickable-transition)' }}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        aria-hidden="true"
        focusable="false"
        className="w-full bg-ij-editor"
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
              stroke="var(--ij-divider)"
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
              data-node-id={node.id}
              data-visited={opened ? 'true' : 'false'}
              data-relation={node.relation}
              fill={opened ? 'var(--ij-ink-info)' : 'var(--ij-editor)'}
              stroke={
                node.relation === 'CONTRADICTS'
                  ? 'var(--ij-accent)'
                  : 'var(--ij-seam-raised)'
              }
              strokeWidth={opened ? 2 : 1}
            />
          );
        })}
      </svg>
      <span className="flex items-baseline justify-between gap-2 font-ij-mono text-ij-island-meta text-ij-ink-info">
        <span className="truncate">{payload.meta.query}</span>
        <span className="shrink-0 tabular-nums">
          {visitedCount}/{payload.nodes.length} opened
        </span>
      </span>
      <ul className="sr-only">
        {payload.nodes.map((node) => (
          <li
            key={node.id}
            data-node-id={node.id}
            data-visited={visitedSet.has(node.id) ? 'true' : 'false'}
          >
            {node.title}: {visitedSet.has(node.id) ? 'opened' : 'not opened'}
          </li>
        ))}
      </ul>
    </button>
  );
}
