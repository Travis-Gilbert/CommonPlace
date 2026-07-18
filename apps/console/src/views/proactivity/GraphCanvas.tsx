'use client';

// SOURCING: elkjs for coordinates (see graph-layout.ts); the render is pure SVG
// through register tokens (no bespoke canvas styling, named choice 9). This is
// the shared renderer the kernel's why-trace (RS1) reads in the other
// direction: map mode draws the standing structure; a firing is the same
// renderer with routeIds set (the map and the route, named choice 3). Node kind
// reads by shape, never color alone; the two converging streams (feeds from a
// source, declares from a stake) are tinted so the join at a watch reads as a
// join, not a pipe (named choice 8).

import { nodeDisabled, type PgEdgeKind, type ProjectedNode } from '@/lib/proactivity/model';
import type { GraphLayout, LaidOutNode } from './graph-layout';

const EDGE_STROKE: Record<PgEdgeKind, string> = {
  feeds: 'var(--ij-memory)',
  declares: 'var(--ij-graph)',
  rests_on: 'var(--ij-ink-info)',
  gates: 'var(--ij-room)',
  acts: 'var(--ij-ink-info)',
};

const KIND_FILL: Record<ProjectedNode['kind'], string> = {
  stake: 'var(--ij-graph-tint)',
  source: 'var(--ij-memory-tint)',
  watch: 'var(--ij-agent-tint)',
  judgment: 'var(--ij-room-tint)',
  response: 'var(--ij-raised)',
  assumption: 'var(--ij-chrome)',
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function pathFor(points: readonly { readonly x: number; readonly y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function nodeLabel(node: ProjectedNode): string {
  switch (node.kind) {
    case 'source':
      return node.label;
    case 'response':
      return node.effectContract.title;
    case 'assumption':
      return node.statement;
    case 'stake':
    case 'watch':
      return node.statement;
    case 'judgment':
      return node.judgmentClass;
    default:
      return '';
  }
}

function ShapeOutline({ node }: { readonly node: LaidOutNode }) {
  const { x, y, width: w, height: h, kind } = node;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const fill = KIND_FILL[kind];
  const common = { fill, stroke: 'var(--ij-seam-raised)', strokeWidth: 1 } as const;
  switch (kind) {
    case 'stake':
      return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} {...common} />;
    case 'watch': {
      const i = Math.min(18, h * 0.4);
      return (
        <polygon
          points={`${x + i},${y} ${x + w - i},${y} ${x + w},${cy} ${x + w - i},${y + h} ${x + i},${y + h} ${x},${cy}`}
          {...common}
        />
      );
    }
    case 'judgment':
      return <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} {...common} />;
    case 'source': {
      const s = 10;
      return <polygon points={`${x + s},${y} ${x + w},${y} ${x + w - s},${y + h} ${x},${y + h}`} {...common} />;
    }
    case 'assumption':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} ry={h / 2} {...common} />;
    case 'response':
    default:
      return <rect x={x} y={y} width={w} height={h} rx={8} ry={8} {...common} />;
  }
}

export function GraphCanvas({
  layout,
  selectedId,
  routeIds,
  onSelect,
}: {
  readonly layout: GraphLayout;
  readonly selectedId: string | null;
  /** When set, the map reads as a route: a firing traced on the same graph
   *  (RS1). Nodes and edges off the route dim. */
  readonly routeIds?: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
}) {
  const onRoute = (id: string): boolean => !routeIds || routeIds.has(id);

  return (
    <svg
      viewBox={`-8 -8 ${layout.width + 16} ${layout.height + 16}`}
      width={layout.width + 16}
      height={layout.height + 16}
      role="group"
      aria-label="The standing proactivity graph"
      className="font-ij-ui"
    >
      <g>
        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            d={pathFor(edge.points)}
            fill="none"
            stroke={EDGE_STROKE[edge.kind]}
            strokeWidth={edge.kind === 'feeds' || edge.kind === 'declares' ? 2 : 1}
          />
        ))}
      </g>
      <g>
        {layout.nodes.map((laid) => {
          const node = laid.node;
          const selected = selectedId === node.id;
          const disabled = nodeDisabled(node);
          const dimmed = disabled || !onRoute(node.id);
          const cx = laid.x + laid.width / 2;
          const cy = laid.y + laid.height / 2;
          const outline = node.degraded.degraded
            ? 'var(--ij-warn)'
            : selected
              ? 'var(--ij-accent)'
              : null;
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${laid.kind}: ${nodeLabel(node)}${disabled ? ', disabled' : ''}${node.degraded.degraded ? `, degraded, ${node.degraded.consequence}` : ''}`}
              aria-pressed={selected}
              className="cursor-pointer"
              opacity={dimmed ? 0.45 : 1}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
            >
              <ShapeOutline node={laid} />
              {outline ? (
                <ShapeOutlineOverlay node={laid} stroke={outline} />
              ) : null}
              {laid.isJoin ? (
                <circle cx={laid.x} cy={cy} r={4} fill="var(--ij-accent)" aria-hidden="true">
                  <title>Join: a fact and a stake converge here</title>
                </circle>
              ) : null}
              <text
                x={cx}
                y={node.kind === 'response' ? cy - 5 : cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--ij-ink)"
              >
                {truncate(nodeLabel(node), laid.width > 170 ? 26 : 16)}
              </text>
              {node.kind === 'response' ? (
                <text
                  x={cx}
                  y={cy + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={
                    node.budget.overBudget
                      ? 'var(--ij-error)'
                      : node.permission.hasGrant
                        ? 'var(--ij-gold)'
                        : 'var(--ij-accent)'
                  }
                >
                  {node.budget.overBudget ? 'over budget' : node.permission.hasGrant ? 'granted' : 'asks every time'}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** A stroke-only overlay of the same shape, for the selected/degraded ring. */
function ShapeOutlineOverlay({ node, stroke }: { readonly node: LaidOutNode; readonly stroke: string }) {
  const { x, y, width: w, height: h, kind } = node;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const common = { fill: 'none', stroke, strokeWidth: 2 } as const;
  switch (kind) {
    case 'stake':
      return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} {...common} />;
    case 'watch': {
      const i = Math.min(18, h * 0.4);
      return (
        <polygon
          points={`${x + i},${y} ${x + w - i},${y} ${x + w},${cy} ${x + w - i},${y + h} ${x + i},${y + h} ${x},${cy}`}
          {...common}
        />
      );
    }
    case 'judgment':
      return <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} {...common} />;
    case 'source': {
      const s = 10;
      return <polygon points={`${x + s},${y} ${x + w},${y} ${x + w - s},${y + h} ${x},${y + h}`} {...common} />;
    }
    case 'assumption':
      return <rect x={x} y={y} width={w} height={h} rx={h / 2} ry={h / 2} {...common} />;
    case 'response':
    default:
      return <rect x={x} y={y} width={w} height={h} rx={8} ry={8} {...common} />;
  }
}
