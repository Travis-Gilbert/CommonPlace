'use client';

import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { SceneRendererProps } from '../types';

export default function MechanismDiagramRenderer({ scenePackage }: SceneRendererProps) {
  const nodes: Node[] = scenePackage.atoms.map((atom, index) => ({
    id: atom.id,
    data: { label: atom.label ?? atom.id },
    position: atom.position
      ? { x: atom.position.x, y: atom.position.y }
      : { x: (index % 3) * 220, y: Math.floor(index / 3) * 120 },
    type: index === 0 ? 'input' : undefined,
  }));
  const edges: Edge[] = scenePackage.relations.map((relation) => ({
    id: relation.id,
    source: relation.sourceId,
    target: relation.targetId,
    label: relation.kind,
    animated: relation.lifecycle === 'entering',
  }));

  return (
    <div className="cp-scene-mechanism">
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
