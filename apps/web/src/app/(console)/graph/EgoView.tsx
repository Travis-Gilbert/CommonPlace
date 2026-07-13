'use client';

// Ego view: a faithful port of D3's Force-Directed Tree
// (https://observablehq.com/@d3/force-directed-tree). The mechanism is copied
// verbatim -- d3.hierarchy over the ego neighbourhood, a live forceSimulation
// with forceLink(distance 0, strength 1) + forceManyBody(-50) + forceX + forceY,
// an on("tick") handler, and the exact drag() behaviour. Only the data (our ego
// BFS tree) and the presentation (porcelain community colours + labels + a11y)
// are ours. Binds the same community/centrality fields as the other views;
// clicking a node re-roots the tree.
//
// prefers-reduced-motion: we run the sim to completion once and render static
// instead of animating; drag still works but does not spin the simulation.

import { useEffect, useMemo, useRef } from 'react';
import { forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { hierarchy } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { drag as d3drag } from 'd3-drag';
import { communityCss, isCommunityActive, nodeRadius, type V2GraphData } from '@/lib/commonplace/v2-graph';
import { nodeIconMarkup } from '@/lib/commonplace/node-icons';
import styles from './graph.module.css';

const MAX_DEPTH = 3;
const MAX_CHILDREN = 8;

interface EgoDatum {
  id: string;
  name: string;
  type: string;
  community: number;
  centrality: number;
  isRoot: boolean;
  children: EgoDatum[];
}

interface EgoViewProps {
  data: V2GraphData;
  focusId: string | null;
  onFocus: (id: string) => void;
  selectedCommunities: readonly number[] | null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// BFS a spanning tree out from the focus and shape it as hierarchical data.
function buildEgoHierarchy(data: V2GraphData, focusId: string | null): EgoDatum | null {
  if (data.nodes.length === 0) return null;
  const root =
    (focusId && data.byId.get(focusId)) ||
    [...data.nodes].sort((a, b) => b.centrality - a.centrality)[0];
  if (!root) return null;

  const seen = new Set<string>([root.id]);
  const make = (id: string): EgoDatum => {
    const n = data.byId.get(id)!;
    return { id: n.id, name: n.label, type: n.type, community: n.community, centrality: n.centrality, isRoot: id === root.id, children: [] };
  };
  const rootDatum = make(root.id);

  const expand = (node: EgoDatum, depth: number) => {
    if (depth >= MAX_DEPTH) return;
    const children = (data.adjacency.get(node.id) ?? [])
      .filter((nid) => !seen.has(nid))
      .map((nid) => data.byId.get(nid))
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .sort((a, b) => b.centrality - a.centrality)
      .slice(0, MAX_CHILDREN);
    for (const child of children) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      const childDatum = make(child.id);
      node.children.push(childDatum);
      expand(childDatum, depth + 1);
    }
  };
  expand(rootDatum, 0);
  return rootDatum;
}

export default function EgoView({ data, focusId, onFocus, selectedCommunities }: EgoViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rootData = useMemo(() => buildEgoHierarchy(data, focusId), [data, focusId]);

  // Keep the latest callback / filter without re-running the whole simulation.
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const selectedRef = useRef(selectedCommunities);
  selectedRef.current = selectedCommunities;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !rootData) return;

    // --- faithful @d3/force-directed-tree, our data/paint ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const root: any = hierarchy(rootData);
    const links = root.links();
    const nodes = root.descendants();
    const reduce = prefersReducedMotion();

    const simulation = forceSimulation(nodes)
      .force('link', forceLink(links).id((d: any) => d.data.id).distance(0).strength(1))
      // charge is the only thing spreading a distance-0 tree; the example's -50
      // is tuned for flare's ~250 nodes, so scale it up for a small ego (enough
      // spacing that wide labels don't collide). fit() frames whatever results.
      .force('charge', forceManyBody().strength(-Math.max(140, 4200 / Math.sqrt(nodes.length))))
      .force('x', forceX())
      .force('y', forceY());

    const svg = select(svgEl);
    svg.selectAll('*').remove();

    const isDim = (d: any) => !isCommunityActive(d.data.community, selectedRef.current);

    const link = svg
      .append('g')
      .attr('class', styles.egoLinks)
      .selectAll('line')
      .data(links)
      .join('line');

    const nodeG = svg.append('g');
    const node = nodeG
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', styles.egoNode)
      .attr('role', 'button')
      .attr('tabindex', 0)
      // Kill the focus box around the <g> bbox (circle + label); the accent ring
      // on the circle (CSS .egoNode:focus-visible circle) is the focus indicator.
      // Inline beats the global .porcelain :focus-visible outline.
      .style('outline', 'none')
      .attr('aria-label', (d: any) => `${d.data.name}${d.data.isRoot ? ' (focused)' : ''}`)
      .style('opacity', (d: any) => (isDim(d) ? 0.2 : 1))
      .on('click', (_e: unknown, d: any) => onFocusRef.current(d.data.id))
      .on('keydown', (e: KeyboardEvent, d: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocusRef.current(d.data.id);
        }
      });

    node
      .append('circle')
      .attr('r', (d: any) => (d.data.isRoot ? 22 : nodeRadius(d.data.centrality, 9, 20)))
      .attr('fill', (d: any) => communityCss(d.data.community, d.data.isRoot ? 1 : 0.85))
      .attr('stroke-width', (d: any) => (d.data.isRoot ? 3 : 1.5));

    // the "Capacities" move: a type icon drawn inside each node
    node
      .append('g')
      .attr('class', styles.egoIcon)
      .each(function (this: SVGGElement, d: any) {
        const r = d.data.isRoot ? 22 : nodeRadius(d.data.centrality, 9, 20);
        const box = r * 1.15;
        select(this)
          .attr('transform', `translate(${-box / 2},${-box / 2}) scale(${box / 24})`)
          .html(nodeIconMarkup(d.data.type));
      });

    node.append('title').text((d: any) => d.data.name);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', (d: any) => (d.data.isRoot ? 22 : nodeRadius(d.data.centrality, 9, 20)) + 14)
      .text((d: any) => (d.data.name.length > 24 ? `${d.data.name.slice(0, 22)}...` : d.data.name));

    const ticked = () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    };

    node.call(
      d3drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active && !reduce) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
          if (reduce) ticked();
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    // Frame the settled tree (labels extend past nodes, so pad wider on X).
    const fit = () => {
      const padX = 150;
      const padY = 72;
      const xs = nodes.map((d: any) => d.x ?? 0);
      const ys = nodes.map((d: any) => d.y ?? 0);
      const minX = Math.min(...xs) - padX;
      const maxX = Math.max(...xs) + padX;
      const minY = Math.min(...ys) - padY;
      const maxY = Math.max(...ys) + padY;
      svg.attr('viewBox', `${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`);
    };

    if (reduce) {
      simulation.stop();
      simulation.tick(300);
      ticked();
      fit();
    } else {
      simulation.on('tick', ticked).on('end', fit);
    }

    return () => {
      simulation.stop();
      svg.selectAll('*').remove();
    };
  }, [rootData]);

  if (!rootData) {
    return <div className={styles.egoEmpty}>No graph data to focus yet.</div>;
  }

  return (
    <div className={styles.egoFrame}>
      <svg ref={svgRef} className={styles.egoSvg} viewBox="-480 -360 960 720" role="group" aria-label="Ego force-directed tree" />
    </div>
  );
}
