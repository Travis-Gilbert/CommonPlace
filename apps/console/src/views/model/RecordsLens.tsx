'use client';

// SOURCING: RecordTableView (tanstack table/virtual) fed with declared schema
// context from the model studio records lens (SPEC-MODEL-CANVAS-RECORDS RT1).

import { useMemo } from 'react';
import type { ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import type {
  DeclaredModel,
  ObservedModel,
  ObjectTypeMetadata,
} from '@commonplace/data-model-contracts';
import { RecordTableView } from '../RecordTableView';
import type { ModelSelection } from './modelQuery';

export interface RecordsLensProps {
  readonly observed: ObservedModel;
  readonly declared: DeclaredModel;
  readonly selection: ModelSelection | null;
  readonly host: ViewRenderProps['host'];
}

function selectedObjectType(
  declared: DeclaredModel,
  selection: ModelSelection | null,
): ObjectTypeMetadata | null {
  if (selection?.kind === 'declared-type') {
    return declared.objectTypes.find((type) => type.id === selection.key) ?? null;
  }
  return declared.objectTypes[0] ?? null;
}

/** Embed declared schema on an ObjectSet so RecordTableView enters schema mode. */
export function objectSetForDeclaredType(
  declared: DeclaredModel,
  objectType: ObjectTypeMetadata,
  objects: readonly ObjectRef[] = [],
): ObjectSet {
  const fields = declared.fields.filter((field) => field.objectTypeId === objectType.id);
  const views = declared.views.filter((view) => view.objectTypeId === objectType.id);
  const typeKey = objectType.key || objectType.nameSingular;
  const schemaCarrier: ObjectRef = {
    id: `schema-carrier:${objectType.id}`,
    type: typeKey,
    properties: {
      objectTypeKey: typeKey,
      objectTypeMetadata: objectType as unknown as import('@commonplace/block-view/types').JsonValue,
      declaredFields: fields as unknown as import('@commonplace/block-view/types').JsonValue,
      views: views as unknown as import('@commonplace/block-view/types').JsonValue,
      activeViewId: views.find((view) => view.isDefault)?.id ?? views[0]?.id ?? '',
    },
  };
  return {
    objects: objects.length > 0 ? [...objects] : [schemaCarrier],
    shape: {
      types: [typeKey],
      fields: fields.map((field) => field.key),
      relations: [],
      axes: {},
      cardinality: objects.length === 0 ? 'empty' : objects.length === 1 ? 'one' : 'many',
    },
    subscribe: () => () => undefined,
  };
}

export function RecordsLens({ declared, selection, host }: RecordsLensProps) {
  const objectType = selectedObjectType(declared, selection);
  const set = useMemo(() => {
    if (!objectType) return null;
    return objectSetForDeclaredType(declared, objectType);
  }, [declared, objectType]);

  if (!objectType || !set) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-ij-ink-info">
        <p>No declared object type is selected.</p>
        <p className="text-sm">
          Pin an observed type on the diagram, then open the records lens.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-model-records-lens>
      <header className="flex h-ij-toolbar shrink-0 items-center border-b border-ij-seam bg-ij-chrome px-3">
        <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>{objectType.label}</h2>
        <span className="ml-2 text-ij-ink-info">·</span>
        <span className="ml-2 font-ij-mono text-xs text-ij-ink-info" data-mono-ok>
          {typeof objectType.recordCount === 'number' ? objectType.recordCount : 'live'}
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <RecordTableView set={set} host={host} />
      </div>
    </div>
  );
}
