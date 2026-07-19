'use client';

// SOURCING: @xyflow/react (React Flow) for the canvas; elk for coordinates (see
// graph-layout.ts); the CommitNode building block for every node (see
// components/commit-graph.tsx). React Flow owns pan, zoom, selection, and edge
// routing; the nodes and edges are register-styled, so no bespoke canvas
// chrome. The graph is read-and-inspect: nodes are not draggable or connectable,
// selecting a node opens the inspector (named choice 5). The canvas is still, so
// the reduced-motion pass is identical: fitView settles instantly and nothing
// animates on the surface (the register rule).

import { useMemo } from 'react';
import { Background, BackgroundVariant, ReactFlow } from '@xyflow/react';
import { CommitNode } from '@/components/commit-graph';
import { GraphInteractionProvider } from './graph-context';
import type { GraphLayout, ProactivityRFNode } from './graph-layout';
import type { ProactivityEdits } from './use-edits';

// Defined once, outside render, so React Flow does not re-register node types.
const NODE_TYPES = { proactivity: CommitNode };

export function GraphCanvas({
  layout,
  selectedId,
  edits,
  onSelect,
  onCompile,
}: {
  readonly layout: GraphLayout;
  readonly selectedId: string | null;
  readonly edits: ProactivityEdits;
  readonly onSelect: (id: string | null) => void;
  readonly onCompile?: (hint: string) => void;
}) {
  const nodes = useMemo<ProactivityRFNode[]>(
    () => layout.nodes.map((node) => ({ ...node, selected: node.id === selectedId })),
    [layout.nodes, selectedId],
  );

  return (
    <GraphInteractionProvider value={{ edits, onCompile }}>
    <div className="h-full w-full" role="group" aria-label="The standing proactivity graph">
      <ReactFlow
        nodes={nodes}
        edges={layout.edges}
        nodeTypes={NODE_TYPES}
        fitView
        // A programming surface: start at a readable zoom (nodes are legible and
        // stackable), not the fit-everything overview, and let the person pan and
        // zoom to explore and build.
        fitViewOptions={{ padding: 0.14, minZoom: 0.66, maxZoom: 1 }}
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
