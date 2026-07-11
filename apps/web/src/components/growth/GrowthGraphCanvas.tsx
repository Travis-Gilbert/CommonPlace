'use client';

import { useEffect, useRef } from 'react';
import { Graph } from '@cosmos.gl/graph';
import type { GrowthSnapshot } from '@/lib/growth';
import { GROWTH_GRAPH_SPACE, GROWTH_VIZ_TOKENS } from './growth-viz-tokens';
import styles from './growth.module.css';

interface GrowthGraphCanvasProps {
  readonly nodes: GrowthSnapshot['graphNodes'];
  readonly edges: GrowthSnapshot['graphEdges'];
  readonly onStatusChange: (available: boolean) => void;
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function GrowthGraphCanvas({ nodes, edges, onStatusChange }: GrowthGraphCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const statusRef = useRef(onStatusChange);

  useEffect(() => {
    statusRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let graph: Graph | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let disposed = false;
    const handleContextLost = (event: Event): void => {
      event.preventDefault();
      statusRef.current(false);
    };

    try {
      graph = new Graph(mount, {
        backgroundColor: [...GROWTH_VIZ_TOKENS.surface],
        spaceSize: GROWTH_GRAPH_SPACE,
        enableSimulation: !reducedMotion(),
        simulationFriction: 0.1,
        simulationGravity: 0,
        simulationRepulsion: 0.5,
        simulationLinkSpring: 1,
        simulationLinkDistance: GROWTH_GRAPH_SPACE * 0.24,
        simulationDecay: 1800,
        scalePointsOnZoom: false,
        fitViewOnInit: true,
        fitViewDelay: 180,
        fitViewPadding: 0.22,
      });
      graphRef.current = graph;
      void graph.ready.then(() => {
        if (disposed) return;
        canvas = mount.querySelector('canvas');
        canvas?.addEventListener('webglcontextlost', handleContextLost);
        statusRef.current(true);
      }).catch(() => statusRef.current(false));
    } catch {
      statusRef.current(false);
    }

    const visibility = new IntersectionObserver(([entry]) => {
      if (!graphRef.current) return;
      if (entry?.isIntersecting) graphRef.current.unpause();
      else graphRef.current.pause();
    });
    visibility.observe(mount);

    return () => {
      disposed = true;
      visibility.disconnect();
      canvas?.removeEventListener('webglcontextlost', handleContextLost);
      graph?.destroy();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || nodes.length === 0) return;

    const total = nodes.length;
    const index = new Map(nodes.map((node, position) => [node.id, position]));
    const positions = new Float32Array(total * 2);
    const colors = new Float32Array(total * 4);
    const sizes = new Float32Array(total);

    nodes.forEach((node, position) => {
      const angle = (Math.PI * 2 * position) / total - Math.PI / 2;
      const radius = position === 0 ? 0 : 0.24 + Math.min(position, 6) * 0.035;
      positions[position * 2] = (0.5 + Math.cos(angle) * radius) * GROWTH_GRAPH_SPACE;
      positions[position * 2 + 1] = (0.5 + Math.sin(angle) * radius) * GROWTH_GRAPH_SPACE;
      const color = node.ready ? GROWTH_VIZ_TOKENS.readyNode : GROWTH_VIZ_TOKENS.standardNode;
      colors.set(color, position * 4);
      sizes[position] = Math.min(24, 7 + Math.sqrt(node.posteriorMass));
    });

    const linkPairs: number[] = [];
    edges.forEach((edge) => {
      const source = index.get(edge.source);
      const target = index.get(edge.target);
      if (source !== undefined && target !== undefined) linkPairs.push(source, target);
    });
    const linkColors = new Float32Array((linkPairs.length / 2) * 4);
    for (let position = 0; position < linkPairs.length / 2; position += 1) {
      linkColors.set(GROWTH_VIZ_TOKENS.link, position * 4);
    }

    graph.setPointPositions(positions);
    graph.setPointColors(colors);
    graph.setPointSizes(sizes);
    graph.setLinks(new Float32Array(linkPairs));
    graph.setLinkColors(linkColors);
    graph.render(reducedMotion() ? 0 : 0.8);
    graph.fitView(reducedMotion() ? 0 : 180, 0.22, !reducedMotion());
  }, [edges, nodes]);

  return <div ref={mountRef} className={styles.graphCanvas} aria-hidden="true" />;
}
