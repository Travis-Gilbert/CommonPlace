'use client';

// SOURCING: OWOX/models hard fork via @commonplace/model-canvas (Apache-2.0).
// Supersedes hand-rolled DiagramCanvas.tsx per SPEC-COMMONPLACE-MODEL-CANVAS-FORK-1.0.
// MC2-MC5 customizations: live counts, ghosts, Declare (pin), divergence badge.

import { useMemo } from 'react';
import {
  ModelCanvasShell,
  type ModelGraph,
  type ModelNode,
  type ModelEdge,
  type MartNodeData,
} from '@commonplace/model-canvas';
import '@commonplace/model-canvas/canvas.css';
import {
  formatFieldType,
  isPinned,
  type DeclaredModel,
  type ObservedModel,
  type PinKind,
} from '@commonplace/data-model-contracts';
import type { ModelSelection } from '../modelQuery';
import type { LayoutPositions } from './layout';

export interface ForkDiagramCanvasProps {
  readonly observed: ObservedModel;
  readonly declared: DeclaredModel;
  readonly selection: ModelSelection | null;
  readonly pendingPins: readonly string[];
  readonly onSelect: (selection: ModelSelection | null) => void;
  readonly onPin: (observedKey: string, kind: PinKind, parentObservedKey?: string) => void;
  readonly onUnpin: (declaredId: string) => void;
  readonly layoutPositions?: LayoutPositions;
  readonly onLayoutChange?: (positions: LayoutPositions) => void;
}

function recordCountForType(
  declaredTypeId: string,
  declared: DeclaredModel,
  observed: ObservedModel,
): number | undefined {
  const metadata = declared.objectTypes.find((type) => type.id === declaredTypeId);
  if (typeof metadata?.recordCount === 'number' && Number.isFinite(metadata.recordCount)) {
    return metadata.recordCount;
  }
  const observedKey = metadata?.provenance?.observedKey;
  if (!observedKey) return undefined;
  return observed.types.find((type) => type.observedKey === observedKey)?.eventCount;
}

function registryToModelGraph(
  observed: ObservedModel,
  declared: DeclaredModel,
  layoutPositions: LayoutPositions,
  pendingPins: readonly string[],
  onPin: ForkDiagramCanvasProps['onPin'],
): ModelGraph {
  const nodes: ModelNode[] = [];
  const edges: ModelEdge[] = [];
  let col = 0;

  for (const type of declared.objectTypes) {
    const key = `declared:${type.id}`;
    const pos = layoutPositions[key] ?? layoutPositions[type.id] ?? { x: col * 320, y: 40 };
    col += 1;
    const fields = declared.fields.filter((f) => f.objectTypeId === type.id);
    const divergences = declared.divergences.filter((d) => d.objectTypeId === type.id);
    const divergenceCount = divergences.reduce((sum, d) => sum + d.count, 0);
    const node: MartNodeData = {
      key,
      title: type.label || type.nameSingular || type.key,
      inputSource: 'TABLE',
      schema: fields.map((f) => ({
        name: f.key,
        type: formatFieldType(f.fieldType),
        pk: f.key === type.labelIdentifierField,
        description: f.label,
      })),
      position: pos,
      status: 'created',
      owoxId: null,
      _viewMode: 'erd',
      _recordCount: recordCountForType(type.id, declared, observed),
      _divergenceCount: type.enforcement === 'warn' ? divergenceCount : 0,
    };
    nodes.push(node);
  }

  for (const type of observed.types) {
    if (isPinned(type.observedKey, declared)) continue;
    const key = `ghost:${type.observedKey}`;
    const pos = layoutPositions[key] ?? layoutPositions[type.observedKey] ?? { x: col * 320, y: 280 };
    col += 1;
    const coverage = type.fields.length
      ? type.fields.reduce((sum, field) => sum + field.coverage, 0) / type.fields.length
      : 0;
    const node: MartNodeData = {
      key,
      title: type.dataType,
      inputSource: 'TABLE',
      schema: type.fields.map((f) => ({
        name: f.key,
        type: formatFieldType(f.fieldType),
        pk: false,
        description: f.sampleValues?.[0] != null ? String(f.sampleValues[0]) : undefined,
      })),
      position: pos,
      status: pendingPins.includes(type.observedKey) ? 'creating' : 'pending',
      owoxId: null,
      _viewMode: 'erd',
      _ghost: true,
      _coverage: coverage,
      _recordCount: type.eventCount,
      _pendingDeclare: pendingPins.includes(type.observedKey),
      _onDeclare: () => onPin(type.observedKey, 'type'),
    };
    nodes.push(node);
  }

  for (const relation of declared.relations) {
    if (!relation.targetObjectTypeId) continue;
    edges.push({
      id: `declared-relation:${relation.id}`,
      from: `declared:${relation.objectTypeId}`,
      to: `declared:${relation.targetObjectTypeId}`,
      keys: [{ left: relation.key, right: relation.key }],
      bidirectional: false,
      cardinality: relation.direction === 'out' ? '1:N' : 'N:1',
    });
  }

  return { storageId: null, nodes, edges };
}

export function ForkDiagramCanvas({
  observed,
  declared,
  pendingPins,
  onSelect,
  onPin,
  layoutPositions = {},
  onLayoutChange,
}: ForkDiagramCanvasProps) {
  const graph = useMemo(
    () => registryToModelGraph(observed, declared, layoutPositions, pendingPins, onPin),
    [observed, declared, layoutPositions, pendingPins, onPin],
  );

  return (
    <ModelCanvasShell
      graph={graph}
      onGraphChange={(next) => {
        if (!onLayoutChange) return;
        const positions: Record<string, { x: number; y: number }> = {};
        for (const n of next.nodes) {
          positions[n.key] = n.position;
        }
        onLayoutChange(positions);
      }}
      onNodeSelect={(key) => {
        if (!key) {
          onSelect(null);
          return;
        }
        if (key.startsWith('declared:')) {
          onSelect({ kind: 'declared-type', key: key.slice('declared:'.length) });
          return;
        }
        if (key.startsWith('ghost:')) {
          onSelect({ kind: 'observed-type', key: key.slice('ghost:'.length) });
          return;
        }
        onSelect(null);
      }}
    />
  );
}
