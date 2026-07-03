'use client';

// Network view: the global graph on the WebGL canvas (spec PT-007, cosmos.gl).
// Community -> point color, centrality -> point size, click -> focus (the node
// affordance-expansion seam the Ego view reads). This is the machine-active
// pane, so the shell wraps it in the umber register (dark ground).
//
// cosmos.gl renders points/links on the GPU but no text, so node labels are an
// HTML overlay: we track every point's position and, on each sim tick / zoom /
// pan / drag, project space -> screen and move the label spans imperatively
// (no React re-render per frame). Without labels a node cloud is just dots.

import { useEffect, useMemo, useRef } from 'react';
import { Graph } from '@cosmos.gl/graph';
import { communityRgb, isCommunityActive, nodeRadius, type V2GraphData } from '@/lib/commonplace/v2-graph';
import styles from './graph.module.css';

const SPACE = 4096;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function pointColors(
  data: V2GraphData,
  focusId: string | null,
  selectedCommunities: readonly number[] | null,
): Float32Array {
  const neighbors = focusId ? new Set(data.adjacency.get(focusId) ?? []) : null;
  const colors = new Float32Array(data.nodes.length * 4);
  data.nodes.forEach((node, i) => {
    const [r, g, b] = communityRgb(node.community);
    const focusLit = !focusId || node.id === focusId || (neighbors?.has(node.id) ?? false);
    const lit = focusLit && isCommunityActive(node.community, selectedCommunities);
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = lit ? 0.98 : 0.14;
  });
  return colors;
}

interface NetworkViewProps {
  data: V2GraphData;
  focusId: string | null;
  onFocus: (id: string) => void;
  selectedCommunities: readonly number[] | null;
}

export default function NetworkView({ data, focusId, onFocus, selectedCommunities }: NetworkViewProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const positionLabelsRef = useRef<() => void>(() => {});

  // Keep click handling + lit-state pointed at the latest props without
  // recreating the WebGL device or the label spans on every render.
  const clickRef = useRef<(index: number | undefined) => void>(() => {});
  const litRef = useRef<(i: number) => boolean>(() => true);
  const nodeIds = useMemo(() => data.nodes.map((n) => n.id), [data.nodes]);
  clickRef.current = (index) => {
    if (index === undefined) return;
    const id = nodeIds[index];
    if (id) onFocus(id);
  };
  litRef.current = (i) => {
    const node = data.nodes[i];
    if (!node) return false;
    const neighbors = focusId ? data.adjacency.get(focusId) : null;
    const focusLit = !focusId || node.id === focusId || (neighbors?.includes(node.id) ?? false);
    return focusLit && isCommunityActive(node.community, selectedCommunities);
  };

  // Create the graph once; destroy on unmount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reposition = () => positionLabelsRef.current();
    let graph: Graph | null = null;
    try {
      graph = new Graph(mount, {
        backgroundColor: [0.161, 0.129, 0.094, 1], // umber ground, matches --g0 umber (#292118)
        spaceSize: SPACE,
        enableSimulation: !prefersReducedMotion(),
        simulationGravity: 0.16,
        simulationRepulsion: 1.1,
        simulationLinkSpring: 1.2,
        simulationLinkDistance: 14,
        simulationDecay: 2000,
        // Fixed screen-space point size: keeps a sparse fixture legible after
        // fitView zooms out, and keeps dense live graphs readable when zoomed in.
        scalePointsOnZoom: false,
        hoveredPointCursor: 'pointer',
        onClick: (index) => clickRef.current(index),
        onZoom: reposition,
        onSimulationTick: reposition,
        onSimulationEnd: reposition,
        onDrag: reposition,
      });
    } catch {
      graph = null;
    }
    graphRef.current = graph;
    // Reposition labels when the canvas resizes (full-bleed, rail collapse, window).
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reposition) : null;
    ro?.observe(mount);
    return () => {
      ro?.disconnect();
      graph?.destroy();
      graphRef.current = null;
    };
  }, []);

  // Push data + (re)build the label overlay whenever the resolved nodes change.
  useEffect(() => {
    const graph = graphRef.current;
    const labelsHost = labelsRef.current;
    if (!graph || !labelsHost || data.nodes.length === 0) return;

    const index = new Map(data.nodes.map((node, i) => [node.id, i]));
    const positions = new Float32Array(data.nodes.length * 2);
    const sizes = new Float32Array(data.nodes.length);
    const clusters: number[] = [];
    data.nodes.forEach((node, i) => {
      positions[i * 2] = node.x * SPACE;
      positions[i * 2 + 1] = node.y * SPACE;
      sizes[i] = nodeRadius(node.centrality, 9, 26);
      clusters.push(node.community);
    });
    const linkPairs: number[] = [];
    for (const link of data.links) {
      const s = index.get(link.source);
      const t = index.get(link.target);
      if (s !== undefined && t !== undefined) linkPairs.push(s, t);
    }
    const linkColors = new Float32Array((linkPairs.length / 2) * 4);
    for (let i = 0; i < linkPairs.length / 2; i += 1) {
      linkColors[i * 4] = 0.95;
      linkColors[i * 4 + 1] = 0.91;
      linkColors[i * 4 + 2] = 0.85;
      linkColors[i * 4 + 3] = 0.34;
    }

    graph.setPointPositions(positions);
    graph.setPointColors(pointColors(data, focusId, selectedCommunities));
    graph.setPointSizes(sizes);
    graph.setLinks(new Float32Array(linkPairs));
    graph.setLinkColors(linkColors);
    graph.setPointClusters(clusters);

    // Build one label span per node (imperative; not React children).
    labelsHost.replaceChildren();
    const spans = data.nodes.map((node) => {
      const span = document.createElement('span');
      span.className = styles.canvasLabel;
      span.textContent = node.label.length > 30 ? `${node.label.slice(0, 28)}…` : node.label;
      labelsHost.appendChild(span);
      return span;
    });
    const position = () => {
      const g = graphRef.current;
      if (!g) return;
      const flat = g.getPointPositions(); // [x0, y0, x1, y1, ...] in space coords
      if (!flat || flat.length < spans.length * 2) return;
      spans.forEach((span, i) => {
        const [sx, sy] = g.spaceToScreenPosition([flat[i * 2], flat[i * 2 + 1]]);
        span.style.transform = `translate(${sx}px, ${sy}px)`;
        span.style.opacity = litRef.current(i) ? '0.92' : '0.12';
      });
    };
    positionLabelsRef.current = position;

    graph.render(prefersReducedMotion() ? 0 : 0.9);
    graph.fitView(500, 0.26);
    position();
    // The sim keeps spreading nodes after the first fit, so re-fit once it has
    // settled -- generous padding leaves room for labels that extend past nodes.
    const settle = setTimeout(() => {
      graphRef.current?.fitView(500, 0.26);
      position();
    }, 1200);
    return () => clearTimeout(settle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes, data.links]);

  // Recolor points + relabel opacity when focus/filter changes (no re-sim).
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || data.nodes.length === 0) return;
    graph.setPointColors(pointColors(data, focusId, selectedCommunities));
    graph.render(0);
    if (focusId) {
      const idx = data.nodes.findIndex((n) => n.id === focusId);
      if (idx >= 0) graph.selectPointByIndex(idx, true);
    } else {
      graph.unselectPoints();
    }
    positionLabelsRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, selectedCommunities, data.nodes]);

  return (
    <div className={styles.canvasFrame}>
      <div ref={mountRef} className={styles.canvasMount} aria-hidden="true" />
      <div ref={labelsRef} className={styles.canvasLabels} aria-hidden="true" />
      <div className={styles.canvasHint}>
        Click a node to focus its neighborhood. Scroll to zoom, drag to pan.
      </div>
    </div>
  );
}
