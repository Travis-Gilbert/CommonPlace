// SOURCING: @commonplace/okf for the portable model bundle contract.
// Observation overlap is a UI diagnostic only. The Rust model-profile import
// is authoritative and may declare agent-authored object types.

import {
  parseBundle,
  serializeBundle,
  type ModelGraph,
} from '@commonplace/okf';
import type {
  DeclaredModel,
  ObservedModel,
  PinRequest,
  SchemaVersion,
} from '@commonplace/data-model-contracts';

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function selectedIds(version: SchemaVersion | undefined, ids: readonly string[]): Set<string> {
  return new Set(version ? ids.filter((id) => version.objectTypeIds.includes(id)) : ids);
}

export function declaredToModelGraph(
  declared: DeclaredModel,
  version?: SchemaVersion,
): ModelGraph {
  const objectTypes = version?.objectTypes ?? declared.objectTypes;
  const fields = version?.fields ?? declared.fields;
  const relations = version?.relations ?? declared.relations;
  const objectTypeIds = selectedIds(version, objectTypes.map((item) => item.id));
  const fieldIds = new Set(version ? version.fieldIds : fields.map((item) => item.id));
  const relationIds = new Set(version ? version.relationIds : relations.map((item) => item.id));
  const nodes = objectTypes
    .filter((item) => objectTypeIds.has(item.id))
    .map((item, index) => ({
      key: item.key,
      title: item.label || item.nameSingular || item.key,
      inputSource: 'TABLE' as const,
      definition: null,
      owoxId: null,
      schema: fields
        .filter((field) => field.objectTypeId === item.id && fieldIds.has(field.id))
        .map((field) => ({
          name: field.key,
          type: field.fieldType.kind,
          pk: field.key === item.labelIdentifierField,
          description: field.label,
        })),
      position: { x: index * 320, y: 0 },
      status: 'created' as const,
    }));
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const objectTypeKey = (id: string): string =>
    objectTypes.find((item) => item.id === id)?.key ?? id;
  const edges = relations
    .filter((relation) => relationIds.has(relation.id) && relation.targetObjectTypeId)
    .map((relation) => ({
      id: `declared-relation:${relation.id}`,
      from: objectTypeKey(relation.objectTypeId),
      to: objectTypeKey(relation.targetObjectTypeId ?? ''),
      keys: [{ left: relation.key, right: relation.key }],
      bidirectional: false,
      cardinality: relation.direction === 'out' ? '1:N' as const : 'N:1' as const,
    }))
    .filter((edge) => nodeKeys.has(edge.from) && nodeKeys.has(edge.to));
  return { storageId: null, nodes, edges };
}

export function parseOkfBundle(source: string, filename = 'import.md'): ModelGraph {
  const trimmed = source.trim();
  if (filename.endsWith('.json')) {
    const files = JSON.parse(trimmed) as Record<string, string>;
    return parseBundle(files);
  }
  return parseBundle({ [filename]: source });
}

export function serializeOkfBundle(graph: ModelGraph, title: string): Record<string, string> {
  return serializeBundle(graph, title).files;
}

export type OkfImportPlan = {
  readonly pins: readonly PinRequest[];
  readonly unmatchedTables: readonly string[];
  readonly unmatchedFields: readonly string[];
};

/**
 * Report which portable OKF elements overlap the current observed lens. This
 * does not gate registry import; the Rust model profile owns admission.
 */
export function planOkfImport(
  graph: ModelGraph,
  observed: ObservedModel,
  scope: PinRequest['scope'],
): OkfImportPlan {
  const pins: PinRequest[] = [];
  const unmatchedTables: string[] = [];
  const unmatchedFields: string[] = [];

  for (const node of graph.nodes) {
    const observedType = observed.types.find((type) =>
      normalized(type.dataType) === normalized(node.title)
      || normalized(type.observedKey) === normalized(node.key),
    );
    if (!observedType) {
      unmatchedTables.push(node.title);
      continue;
    }
    pins.push({ scope, observedKey: observedType.observedKey, kind: 'type' });
    for (const field of node.schema) {
      const observedField = observedType.fields.find((item) =>
        normalized(item.key) === normalized(field.name),
      );
      if (!observedField) {
        unmatchedFields.push(`${node.title}.${field.name}`);
        continue;
      }
      pins.push({
        scope,
        observedKey: observedField.observedKey,
        kind: 'field',
        parentObservedKey: observedType.observedKey,
      });
    }
  }

  return {
    pins: pins.filter((pin, index) =>
      pins.findIndex((candidate) =>
        candidate.kind === pin.kind
        && candidate.observedKey === pin.observedKey
        && candidate.parentObservedKey === pin.parentObservedKey,
      ) === index,
    ),
    unmatchedTables,
    unmatchedFields,
  };
}
