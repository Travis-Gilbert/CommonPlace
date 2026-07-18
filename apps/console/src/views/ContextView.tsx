'use client';

// SOURCING: D3 for deterministic scale geometry. React owns the SVG so the
// selected object remains the stable render key. No force simulation or
// ambient graph motion exists. Every edge carries a worded reason.

import { useEffect, useMemo, useState } from 'react';
import { scalePoint } from 'd3';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { useMemoryProjectionStore, type HarnessMemoryItem } from '@/lib/memory-projection-store';
import { openMemoryTab } from './FilesView';

interface ContextNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly object?: ObjectRef;
  readonly memory?: HarnessMemoryItem;
  readonly x: number;
  readonly y: number;
}

interface ContextEdge {
  readonly id: string;
  readonly source: ContextNode;
  readonly target: ContextNode;
  readonly reason: string;
}

function words(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

function titleOf(object: ObjectRef): string {
  return String(object.properties.title ?? object.properties.name ?? object.id);
}

function relationReason(edge: string): string {
  const words = edge.toLowerCase().replaceAll('_', ' ');
  return `Connected by ${words}`;
}

export function ContextView({ host }: { host: BlockHost }) {
  const selected = useShellStore((state) => state.contextObject);
  const selectRecord = useShellStore((state) => state.selectRecord);
  const memories = useMemoryProjectionStore((state) => state.items);
  const [candidates, setCandidates] = useState<readonly ObjectRef[]>([]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    Promise.resolve(host.query({
      types: ['record', 'person', 'task', 'project', 'org', 'doc'],
      page: { limit: 200 },
    })).then((set) => {
      if (active) setCandidates(set.objects);
    }).catch(() => {
      if (active) setCandidates([]);
    });
    return () => {
      active = false;
    };
  }, [host, selected]);

  const graph = useMemo(() => {
    if (!selected) return { nodes: [] as ContextNode[], edges: [] as ContextEdge[] };
    const byId = new Map(candidates.map((object) => [object.id, object]));
    const related: Array<{ object: ObjectRef; reason: string }> = [];
    const seen = new Set<string>([selected.id]);
    for (const [edge, ids] of Object.entries(selected.relations ?? {})) {
      for (const id of ids) {
        const object = byId.get(id);
        if (!object || seen.has(id)) continue;
        seen.add(id);
        related.push({ object, reason: relationReason(edge) });
      }
    }
    const selectedTags = new Set(words(selected.properties.tags));
    if (related.length < 8 && selectedTags.size > 0) {
      for (const object of candidates) {
        if (seen.has(object.id)) continue;
        const shared = words(object.properties.tags).find((tag) => selectedTags.has(tag));
        if (!shared) continue;
        seen.add(object.id);
        related.push({ object, reason: `Shares the ${shared} tag` });
        if (related.length >= 8) break;
      }
    }
    const rowSlots = scalePoint<number>().domain([0, 1, 2, 3]).range([120, 276]);
    const center: ContextNode = { id: selected.id, label: titleOf(selected), kind: selected.type, object: selected, x: 160, y: 48 };
    const nodes: ContextNode[] = [center];
    const edges: ContextEdge[] = [];
    related.slice(0, 8).forEach(({ object, reason }, index) => {
      const node: ContextNode = {
        id: object.id,
        label: titleOf(object),
        kind: object.type,
        object,
        x: index % 2 === 0 ? 76 : 244,
        y: rowSlots(Math.floor(index / 2)) ?? 120,
      };
      nodes.push(node);
      edges.push({ id: `${center.id}:${node.id}`, source: center, target: node, reason });
    });
    const selectedTerms = new Set([...selectedTags, ...titleOf(selected).toLowerCase().split(/\s+/)]);
    const memoryMatches = memories
      .filter((memory) => {
        const haystack = `${memory.title} ${JSON.stringify(memory.extra)}`.toLowerCase();
        return [...selectedTerms].some((term) => term.length > 2 && haystack.includes(term.toLowerCase()));
      })
      .slice(0, 2);
    memoryMatches.forEach((memory, index) => {
      const node: ContextNode = {
        id: memory.id,
        label: memory.title,
        kind: 'memory',
        memory,
        x: index === 0 ? 84 : 236,
        y: 340,
      };
      nodes.push(node);
      edges.push({ id: `${center.id}:memory:${node.id}`, source: center, target: node, reason: 'Memory mentions the selected context' });
    });
    return { nodes, edges };
  }, [candidates, memories, selected]);

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-ij-ink-info" data-context-empty>
        Select an object to inspect its context.
      </div>
    );
  }

  const activate = (node: ContextNode) => {
    if (node.memory) void openMemoryTab(host, node.memory);
    else if (node.object) selectRecord(node.object.id, node.object, node.object.type);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-ij-chrome" data-context-view data-context-key={selected.id}>
      <svg viewBox="0 0 320 372" role="img" aria-labelledby="context-title context-description" className="min-h-0 w-full flex-1">
        <title id="context-title">Context for {titleOf(selected)}</title>
        <desc id="context-description">A deterministic ego graph with labeled relation reasons and related memories.</desc>
        {graph.edges.map((edge) => (
          <line
            key={edge.id}
            x1={edge.source.x}
            y1={edge.source.y}
            x2={edge.target.x}
            y2={edge.target.y}
            stroke="var(--ij-divider)"
            aria-label={edge.reason}
          />
        ))}
        {graph.nodes.map((node, index) => (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={`${node.label}, ${node.kind}`}
            onClick={() => activate(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate(node);
              }
            }}
            className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-ij-accent"
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={index === 0 ? 18 : 13}
              fill={node.kind === 'memory' ? 'var(--ij-gold)' : index === 0 ? 'var(--ij-accent)' : 'var(--ij-raised)'}
              stroke={node.kind === 'memory' || index === 0 ? 'var(--ij-seam-raised)' : 'var(--ij-divider)'}
            />
            <text x={node.x} y={node.y + (index === 0 ? 32 : 27)} textAnchor="middle" fill="var(--ij-ink)" className="font-ij-ui">
              {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
            </text>
            <title>{node.label}</title>
          </g>
        ))}
      </svg>
      <div className="max-h-40 overflow-y-auto border-t border-ij-seam p-2 text-ij-ink-info" aria-label="Connection reasons">
        {graph.edges.length > 0
          ? graph.edges.map((edge) => (
              <p key={edge.id} className="mb-1 last:mb-0">
                <span className="text-ij-ink">{edge.target.label}</span>
                <span aria-hidden="true"> · </span>
                {edge.reason}
              </p>
            ))
          : <p>No reasoned neighbors are available for this selection.</p>}
      </div>
    </div>
  );
}
