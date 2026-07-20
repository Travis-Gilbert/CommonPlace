'use client';

// SOURCING: @xyflow/react (React Flow) for the canvas; dagre for coordinates
// (see graph-layout.ts); the ADOPTED jalco commit-graph for every node and
// every edge (CommitNode.tsx renders its `CommitRow`, RailEdge.tsx draws with
// its `railPath`). React Flow owns pan, zoom, selection, and edge routing; the
// nodes and edges are register-styled, so no bespoke canvas chrome. The graph
// is read-and-inspect: nodes are not draggable or connectable, selecting a node
// opens the inspector (named choice 5). The canvas is still, so the
// reduced-motion pass is identical: fitView settles instantly and nothing
// animates on the surface (the register rule).

import { useMemo } from 'react';
import { Background, BackgroundVariant, ReactFlow } from '@xyflow/react';
import { CandidateNode, CommitNode } from './CommitNode';
import { RailEdge } from './RailEdge';
import type { CommitView } from './commits';
import { GraphInteractionProvider } from './graph-context';
import type { CanvasNode, GraphLayout } from './graph-layout';
import type { ProactivityEdits } from './use-edits';

// Defined once, outside render, so React Flow does not re-register the types.
const NODE_TYPES = { proactivity: CommitNode, candidate: CandidateNode };
const EDGE_TYPES = { rail: RailEdge };

export function GraphCanvas({
  layout,
  candidates,
  selectedId,
  edits,
  commits,
  lit,
  onSelect,
  onCompile,
}: {
  readonly layout: GraphLayout;
  /** Uncommitted commits, positioned ahead of HEAD by the altitude above. */
  readonly candidates: readonly CanvasNode[];
  readonly selectedId: string | null;
  readonly edits: ProactivityEdits;
  readonly commits: ReadonlyMap<string, CommitView>;
  readonly lit: ReadonlySet<string>;
  readonly onSelect: (id: string | null) => void;
  readonly onCompile?: (hint: string) => void;
}) {
  const nodes = useMemo<CanvasNode[]>(
    () => [...layout.nodes.map((node) => ({ ...node, selected: node.id === selectedId })), ...candidates],
    [layout.nodes, selectedId, candidates],
  );
  const interaction = useMemo(() => ({ edits, onCompile, commits, lit }), [edits, onCompile, commits, lit]);

  return (
    <GraphInteractionProvider value={interaction}>
    <div className="h-full w-full" role="group" aria-label="The standing proactivity graph">
      <ReactFlow<CanvasNode>
        nodes={nodes}
        edges={layout.edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        // A programming surface: start at a readable zoom (nodes are legible and
        // stackable), not the fit-everything overview, and let the person pan and
        // zoom to explore and build.
        // Padding, not a lower minZoom: a commit row has to stay readable, so
        // the graph opens at a legible zoom and is panned rather than shrunk.
        // The padding is what keeps the first commit off the top edge now that
        // rows are two lines tall.
        fitViewOptions={{ padding: 0.22, minZoom: 0.66, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        edgesFocusable={false}
        selectNodesOnDrag={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_event, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--ij-seam-raised)" />
      </ReactFlow>
    </div>
    </GraphInteractionProvider>
  );
}
