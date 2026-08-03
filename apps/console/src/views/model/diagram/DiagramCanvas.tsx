'use client';

// SOURCING: @xyflow/react wrap plus @dagrejs/dagre layout (see layout.ts).

import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react';
import {
  formatFieldType,
  isPinned,
  type DeclaredModel,
  type ObservedModel,
  type PinKind,
} from '@commonplace/data-model-contracts';
import type { ModelSelection } from '../modelQuery';
import { GhostCard } from './GhostCard';
import { ObjectTypeCard } from './ObjectTypeCard';
import { RelationEdge } from './RelationEdge';
import {
  layoutModelGraph,
  type GhostCardData,
  type GhostFlowNode,
  type LayoutPositions,
  type ModelFlowEdge,
  type ModelFlowNode,
  type ObjectTypeCardData,
  type ObjectTypeFlowNode,
  type ObjectTypeRelationRow,
  type ObjectTypeScalarField,
} from './layout';
import { tintForKey } from './tints';

const NODE_TYPES: NodeTypes = {
  objectType: ObjectTypeCard,
  ghost: GhostCard,
};

const EDGE_TYPES: EdgeTypes = {
  relation: RelationEdge,
};

export interface DiagramCanvasProps {
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

function divergencesForType(declared: DeclaredModel, objectTypeId: string) {
  return declared.divergences.filter((item) => item.objectTypeId === objectTypeId);
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
  const observedType = observed.types.find((type) => type.observedKey === observedKey);
  return observedType?.eventCount;
}

function buildDeclaredNodes(
  declared: DeclaredModel,
  observed: ObservedModel,
  selection: ModelSelection | null,
  expandedByType: Readonly<Record<string, boolean>>,
  onSelect: (selection: ModelSelection) => void,
  setExpandedByType: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void,
): ObjectTypeFlowNode[] {
  return declared.objectTypes.map((type) => {
    const divergences = divergencesForType(declared, type.id);
    const divergenceCount = divergences.reduce((sum, item) => sum + item.count, 0);
    const divergenceSignalIds = divergences.flatMap((item) => item.signalNodeIds);
    const relations: ObjectTypeRelationRow[] = declared.relations
      .filter((relation) => relation.objectTypeId === type.id)
      .map((relation) => {
        const target = declared.objectTypes.find((candidate) => candidate.id === relation.targetObjectTypeId);
        const targetTint = tintForKey(target?.key ?? target?.label ?? relation.label);
        return {
          id: relation.id,
          key: relation.key,
          label: relation.label,
          targetLabel: target?.label ?? 'unknown',
          targetTint,
        };
      });
    const scalarFields: ObjectTypeScalarField[] = declared.fields
      .filter((field) => field.objectTypeId === type.id)
      .map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        fieldTypeLabel: formatFieldType(field.fieldType),
        required: field.required,
        fieldType: field.fieldType,
      }));

    const data: ObjectTypeCardData = {
      id: type.id,
      label: type.label,
      recordCount: recordCountForType(type.id, declared, observed),
      enforcement: type.enforcement,
      system: type.system,
      tint: tintForKey(type.key),
      relations,
      scalarFields,
      divergenceCount,
      divergenceSignalIds,
      expandedFields: expandedByType[type.id] ?? false,
      isSelected: selection?.kind === 'declared-type' && selection.key === type.id,
      onSelect,
      onOpenDivergences: () => onSelect({ kind: 'declared-type', key: type.id }),
      onToggleFields: () => setExpandedByType((current) => ({
        ...current,
        [type.id]: !current[type.id],
      })),
    };

    return {
      id: `declared:${type.id}`,
      type: 'objectType',
      position: { x: 0, y: 0 },
      data,
      draggable: true,
      connectable: false,
    };
  });
}

function buildGhostNodes(
  observed: ObservedModel,
  declared: DeclaredModel,
  selection: ModelSelection | null,
  pendingPins: readonly string[],
  onSelect: (selection: ModelSelection) => void,
  onPin: DiagramCanvasProps['onPin'],
): GhostFlowNode[] {
  return observed.types
    .filter((type) => !isPinned(type.observedKey, declared))
    .map((type) => {
      const coverage = type.fields.length
        ? type.fields.reduce((sum, field) => sum + field.coverage, 0) / type.fields.length
        : 0;
      return {
        id: `ghost:${type.observedKey}`,
        type: 'ghost' as const,
        position: { x: 0, y: 0 },
        draggable: true,
        connectable: false,
        data: {
          observedKey: type.observedKey,
          label: type.dataType,
          coverage,
          occurrences: type.eventCount,
          fields: type.fields,
          pinned: isPinned(type.observedKey, declared),
          pendingPin: pendingPins.includes(type.observedKey),
          onSelect,
          onPin: () => onPin(type.observedKey, 'type'),
        },
      };
    });
}

function buildRelationEdges(
  declared: DeclaredModel,
  expandedByType: Readonly<Record<string, boolean>>,
  observed: ObservedModel,
): ModelFlowEdge[] {
  return declared.relations
    .filter((relation) => relation.targetObjectTypeId)
    .map((relation) => {
      const sourceExpanded = expandedByType[relation.objectTypeId] ?? false;
      const observedEdge = observed.types
        .flatMap((type) => type.edges)
        .find((edge) => edge.observedKey === relation.provenance?.observedKey);
      return {
        id: `declared-relation:${relation.id}`,
        source: `declared:${relation.objectTypeId}`,
        target: `declared:${relation.targetObjectTypeId}`,
        type: 'relation' as const,
        sourceHandle: sourceExpanded ? `rel:${relation.key}` : 'card',
        data: {
          label: relation.label,
          cardinalityLabel: relation.direction === 'out' ? 'out' : 'in',
          coverage: observedEdge ? observedEdge.occurrences / Math.max(1, observed.types.length) : undefined,
          occurrences: observedEdge?.occurrences,
        },
      };
    });
}

export function DiagramCanvas({
  observed,
  declared,
  selection,
  pendingPins,
  onSelect,
  onPin,
  layoutPositions = {},
  onLayoutChange,
}: DiagramCanvasProps) {
  const [expandedByType, setExpandedByType] = useState<Record<string, boolean>>({});
  const [localPositions, setLocalPositions] = useState<LayoutPositions>(layoutPositions);

  const mergedPositions = useMemo(
    () => ({ ...layoutPositions, ...localPositions }),
    [layoutPositions, localPositions],
  );

  const handleSelect = useCallback(
    (next: ModelSelection) => onSelect(next),
    [onSelect],
  );

  const rawNodes = useMemo(() => {
    const declaredNodes = buildDeclaredNodes(
      declared,
      observed,
      selection,
      expandedByType,
      handleSelect,
      setExpandedByType,
    );
    const ghostNodes = buildGhostNodes(
      observed,
      declared,
      selection,
      pendingPins,
      handleSelect,
      onPin,
    );
    return [...declaredNodes, ...ghostNodes] as ModelFlowNode[];
  }, [
    declared,
    observed,
    selection,
    expandedByType,
    pendingPins,
    handleSelect,
    onPin,
  ]);

  const edges = useMemo(
    () => buildRelationEdges(declared, expandedByType, observed),
    [declared, expandedByType, observed],
  );

  const nodes = useMemo(
    () => layoutModelGraph(rawNodes, edges, mergedPositions),
    [rawNodes, edges, mergedPositions],
  );

  const onNodeDragStop: OnNodeDrag<ModelFlowNode> = useCallback((_event, node) => {
    const next = { ...mergedPositions, [node.id]: node.position };
    setLocalPositions(next);
    onLayoutChange?.(next);
  }, [mergedPositions, onLayoutChange]);

  if (declared.objectTypes.length === 0 && observed.types.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-ij-editor p-8 text-center text-ij-ink-info">
        <p>No observed or declared types exist in this topic.</p>
        <p className="text-sm">When events arrive, pin observed shapes here to declare them.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-80 bg-ij-editor" aria-label="Observed and declared model diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onPaneClick={() => onSelect(null)}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={(_event, edge) => {
          if (edge.id.startsWith('declared-relation:')) {
            onSelect({ kind: 'declared-relation', key: edge.id.slice('declared-relation:'.length) });
          }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="var(--ij-seam-raised)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
