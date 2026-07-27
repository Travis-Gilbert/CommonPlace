'use client';

// SOURCING: @cosmos.gl/graph 3.1.0. Cosmos owns WebGL paint, pointer pan,
// zoom, fit, and point selection. Shared Rust B2 positions are supplied as a
// fixed array, so this realm does not run a second force simulation.

import { useEffect, useRef, useState } from 'react';
import type { Graph as CosmosGraph } from '@cosmos.gl/graph';
import { orderedPositionArray } from '@commonplace/console-block/fixture-layout';
import type { GraphSlice } from '@commonplace/console-block/types';
import { useMotionDurations } from '@/motion/motion-tokens';

export interface CosmosGraphSurfaceProps {
  readonly graph: GraphSlice;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (nodeId: string | null) => void;
}

function resolvedClassColor(container: HTMLElement, className: string): string {
  const probe = document.createElement('span');
  probe.className = className;
  probe.hidden = true;
  container.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

export function CosmosGraphSurface({
  graph,
  selectedNodeId,
  onSelectNode,
}: CosmosGraphSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cosmosRef = useRef<CosmosGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const durations = useMotionDurations();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    setError(null);
    void import('@cosmos.gl/graph')
      .then(async ({ Graph }) => {
        if (disposed) return;
        const containerStyle = getComputedStyle(container);
        const cosmos = new Graph(container, {
          enableSimulation: false,
          enableDrag: true,
          backgroundColor: containerStyle.backgroundColor,
          pointDefaultColor: resolvedClassColor(container, 'text-ij-graph'),
          pointDefaultSize: 12,
          linkDefaultColor: containerStyle.borderTopColor,
          linkDefaultWidth: 1,
          linkDefaultArrows: true,
          renderHoveredPointRing: true,
          hoveredPointRingColor: resolvedClassColor(container, 'text-ij-accent'),
          focusedPointRingColor: resolvedClassColor(container, 'text-ij-gold'),
          hoveredPointCursor: 'pointer',
          fitViewOnInit: true,
          fitViewDelay: 0,
          fitViewPadding: 0.18,
          fitViewDuration: durations.base,
          transitionDuration: durations.fast,
          onPointClick(index) {
            onSelectNode(graph.nodes[index]?.id ?? null);
          },
          onBackgroundClick() {
            onSelectNode(null);
          },
        });
        cosmosRef.current = cosmos;
        const nodeIndex = new Map(graph.nodes.map((node, index) => [node.id, index]));
        cosmos.setPointPositions(
          orderedPositionArray(graph.nodes.map((node) => node.id)),
          true,
        );
        cosmos.setLinks(
          new Float32Array(
            graph.edges.flatMap((edge) => {
              const source = nodeIndex.get(edge.source);
              const target = nodeIndex.get(edge.target);
              return source === undefined || target === undefined ? [] : [source, target];
            }),
          ),
        );
        cosmos.render(0);
        await cosmos.ready;
        if (disposed) {
          cosmos.destroy();
          return;
        }

        resizeObserver = new ResizeObserver(() => {
          cosmos.fitView(durations.reduced ? 0 : durations.fast, 0.18, false);
        });
        resizeObserver.observe(container);
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : 'Graph renderer unavailable');
        }
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      cosmosRef.current?.destroy();
      cosmosRef.current = null;
    };
  }, [durations.base, durations.fast, durations.reduced, graph, onSelectNode]);

  useEffect(() => {
    const selectedIndex = graph.nodes.findIndex((node) => node.id === selectedNodeId);
    cosmosRef.current?.setConfigPartial({
      focusedPointIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    });
  }, [graph.nodes, selectedNodeId]);

  return (
    <div className="relative h-full min-h-72 w-full">
      <div
        ref={containerRef}
        data-console-cosmos-graph
        role="img"
        aria-label={`Graph neighborhood with ${graph.nodes.length} nodes and ${graph.edges.length} edges`}
        className="h-full min-h-72 w-full overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-editor"
      />
      {error ? (
        <p role="alert" className="absolute inset-x-0 top-0 bg-ij-error-bg p-2 text-ij-error">
          Graph renderer unavailable: {error}
        </p>
      ) : null}
    </div>
  );
}
