'use client';

import CosmosGraphCanvas from '@/components/theseus/explorer/CosmosGraphCanvas';
import type { CosmoLink, CosmoPoint } from '@/components/theseus/explorer/useGraphData';
import type { SceneRendererProps } from '../types';

export default function GraphNeighborhoodRenderer({ scenePackage }: SceneRendererProps) {
  const relationDegree = new Map<string, number>();
  for (const relation of scenePackage.relations) {
    relationDegree.set(relation.sourceId, (relationDegree.get(relation.sourceId) ?? 0) + 1);
    relationDegree.set(relation.targetId, (relationDegree.get(relation.targetId) ?? 0) + 1);
  }
  const points: CosmoPoint[] = scenePackage.atoms.map((atom) => ({
    id: atom.id,
    label: atom.label ?? atom.id,
    type: atom.kind ?? 'claim',
    colorHex: validHex(atom.color) ? atom.color : '#A65324',
    degree: relationDegree.get(atom.id) ?? 0,
    description: readString(atom.metadata?.body) ?? readString(atom.metadata?.summary),
  }));
  const links: CosmoLink[] = scenePackage.relations.map((relation) => ({
    source: relation.sourceId,
    target: relation.targetId,
    weight: relation.weight ?? 1,
    reason: relation.kind,
  }));
  const pinnedPositions = Object.fromEntries(
    scenePackage.atoms
      .filter((atom) => atom.position)
      .map((atom) => [atom.id, [atom.position?.x ?? 0, atom.position?.y ?? 0] as [number, number]]),
  );

  return (
    <div className="cp-scene-graph-neighborhood">
      <CosmosGraphCanvas points={points} links={links} pinnedPositions={pinnedPositions} labelsOn />
    </div>
  );
}

function validHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
