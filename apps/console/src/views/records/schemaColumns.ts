// SOURCING: RecordTableView width ladder (Twenty structural column admission).
// Builds schema-aware column descriptors from declared model metadata.

import type { VisibilityState } from '@tanstack/react-table';
import type {
  FieldMetadata,
  FieldType,
  ObjectTypeMetadata,
  ViewFilter,
  ViewFilterOp,
  ViewMetadata,
  ViewSort,
} from '@commonplace/data-model-contracts';
import { parseFieldType } from '@commonplace/data-model-contracts';
import type { JsonValue, ObjectRef, ObjectSet, Predicate, Ranker } from '@commonplace/block-view/types';

export interface SchemaColumnDef {
  readonly fieldKey: string;
  readonly label: string;
  readonly fieldType: FieldType;
  readonly widthClass: string;
  readonly widthPx: number;
}

export interface RecordSchemaContext {
  readonly objectTypeKey?: string;
  readonly objectType?: ObjectTypeMetadata;
  readonly fields: readonly FieldMetadata[];
  readonly views: readonly ViewMetadata[];
  readonly activeViewId?: string;
}

const DEFAULT_WIDTH_PX = 112;
const TITLE_MIN = 160;
const UTILITY_WIDTH = 32;

function columnWidthPx(fieldType: FieldType): number {
  switch (fieldType.kind) {
    case 'boolean':
      return 80;
    case 'date':
    case 'timestamp':
      return 128;
    case 'enum':
      return 112;
    case 'relation':
      return 176;
    case 'long_text':
    case 'json':
    case 'geometry':
    case 'vector':
      return 192;
    default:
      return DEFAULT_WIDTH_PX;
  }
}

function widthClassForField(fieldKey: string, fieldType: FieldType): string {
  if (fieldKey === 'title' || fieldKey.endsWith('.title')) return 'min-w-0 flex-1';
  switch (fieldType.kind) {
    case 'boolean':
      return 'shrink-0 w-20';
    case 'relation':
      return 'shrink-0 w-44';
    case 'long_text':
    case 'json':
      return 'shrink-0 w-48';
    default:
      return 'shrink-0 w-28';
  }
}

function viewColumnOrder(view?: ViewMetadata, shapeFields?: readonly string[]): readonly string[] {
  if (view?.columns && view.columns.length > 0) {
    return [...view.columns]
      .sort((a, b) => a.order - b.order)
      .filter((column) => column.visible)
      .map((column) => column.fieldKey);
  }
  const extended = view as (ViewMetadata & { columnOrder?: readonly string[] }) | undefined;
  if (extended?.columnOrder && extended.columnOrder.length > 0) {
    return extended.columnOrder;
  }
  return shapeFields ?? [];
}

/** Column descriptors: label identifier first, then view order, then the rest. */
export function columnsFromObjectType(
  objectType: ObjectTypeMetadata,
  fields: readonly FieldMetadata[],
  view?: ViewMetadata,
  shapeFields?: readonly string[],
): SchemaColumnDef[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const orderedKeys: string[] = [];
  const seen = new Set<string>();

  const pushKey = (key: string) => {
    if (!key || seen.has(key) || !byKey.has(key)) return;
    seen.add(key);
    orderedKeys.push(key);
  };

  pushKey(objectType.labelIdentifierField);

  for (const key of viewColumnOrder(view, shapeFields)) pushKey(key);

  for (const field of fields) pushKey(field.key);

  return orderedKeys.map((fieldKey) => {
    const field = byKey.get(fieldKey)!;
    return {
      fieldKey,
      label: field.label || fieldKey,
      fieldType: field.fieldType,
      widthClass: widthClassForField(fieldKey, field.fieldType),
      widthPx: columnWidthPx(field.fieldType),
    };
  });
}

/** Admit columns from the right until the title measure still fits. */
export function visibilityForWidth(
  width: number,
  columns: readonly SchemaColumnDef[],
  labelFieldKey?: string,
): VisibilityState {
  const visibility: VisibilityState = { utility: width >= TITLE_MIN + UTILITY_WIDTH };
  let used = UTILITY_WIDTH;
  const labelColumn = columns.find((column) => column.fieldKey === labelFieldKey) ?? columns[0];
  const trailing = columns.filter((column) => column !== labelColumn);

  for (const column of trailing) {
    const next = used + column.widthPx;
    if (width >= TITLE_MIN + next) {
      visibility[column.fieldKey] = true;
      used = next;
    } else {
      visibility[column.fieldKey] = false;
    }
  }
  if (labelColumn) visibility[labelColumn.fieldKey] = true;
  return visibility;
}

function readJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseObjectType(value: unknown): ObjectTypeMetadata | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const key = typeof record.key === 'string' ? record.key : id;
  if (!key) return undefined;
  return {
    id: id || key,
    key,
    label: typeof record.label === 'string' ? record.label : key,
    enforcement: record.enforcement === 'warn' || record.enforcement === 'reject' ? record.enforcement : 'observe',
    nameSingular: typeof record.nameSingular === 'string' ? record.nameSingular : key,
    namePlural: typeof record.namePlural === 'string' ? record.namePlural : `${key}s`,
    labelIdentifierField: typeof record.labelIdentifierField === 'string'
      ? record.labelIdentifierField
      : typeof record.label_identifier_field === 'string'
        ? record.label_identifier_field
        : 'title',
    system: Boolean(record.system),
    contentAnchor: typeof record.contentAnchor === 'string' ? record.contentAnchor : '',
  };
}

function parseFieldMetadata(value: unknown, objectTypeId: string): FieldMetadata | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const key = typeof record.key === 'string' ? record.key : '';
  if (!key) return undefined;
  const id = typeof record.id === 'string' ? record.id : `${objectTypeId}:${key}`;
  return {
    id,
    objectTypeId,
    key,
    label: typeof record.label === 'string' ? record.label : key,
    fieldType: parseFieldType(record.fieldType ?? record.field_type),
    required: Boolean(record.required),
  };
}

const VIEW_FILTER_OPS = new Set<ViewFilterOp>([
  'eq',
  'neq',
  'contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_empty',
  'is_not_empty',
  'in',
]);

function parseViewFilter(value: unknown): ViewFilter | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const fieldKey = typeof record.fieldKey === 'string'
    ? record.fieldKey
    : typeof record.field_key === 'string'
      ? record.field_key
      : '';
  const opRaw = typeof record.op === 'string' ? record.op : '';
  if (!fieldKey || !VIEW_FILTER_OPS.has(opRaw as ViewFilterOp)) return undefined;
  return {
    fieldKey,
    op: opRaw as ViewFilterOp,
    ...('value' in record ? { value: record.value } : {}),
  };
}

function parseViewSort(value: unknown): ViewSort | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const fieldKey = typeof record.fieldKey === 'string'
    ? record.fieldKey
    : typeof record.field_key === 'string'
      ? record.field_key
      : '';
  const direction = record.direction === 'desc' ? 'desc' : record.direction === 'asc' ? 'asc' : null;
  if (!fieldKey || !direction) return undefined;
  return { fieldKey, direction };
}

export function parseViewMetadata(value: unknown): ViewMetadata | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  const key = typeof record.key === 'string' ? record.key : id;
  const objectTypeId = typeof record.objectTypeId === 'string'
    ? record.objectTypeId
    : typeof record.object_type_id === 'string'
      ? record.object_type_id
      : '';
  if (!key || !objectTypeId) return undefined;
  const columns = Array.isArray(record.columns)
    ? record.columns.flatMap((item, index) => {
      if (typeof item !== 'object' || item === null) return [];
      const column = item as Record<string, unknown>;
      const fieldKey = typeof column.fieldKey === 'string'
        ? column.fieldKey
        : typeof column.field_key === 'string'
          ? column.field_key
          : '';
      if (!fieldKey) return [];
      return [{
        fieldKey,
        visible: column.visible !== false,
        ...(typeof column.width === 'number' ? { width: column.width } : {}),
        order: typeof column.order === 'number' ? column.order : index,
      }];
    })
    : [];
  const filters = Array.isArray(record.filters)
    ? record.filters.map(parseViewFilter).filter((entry): entry is ViewFilter => entry !== undefined)
    : [];
  const sorts = Array.isArray(record.sorts)
    ? record.sorts.map(parseViewSort).filter((entry): entry is ViewSort => entry !== undefined)
    : [];
  return {
    id: id || key,
    key,
    label: typeof record.label === 'string' ? record.label : key,
    objectTypeId,
    filters,
    sorts,
    columns,
    isDefault: Boolean(record.isDefault ?? record.is_default),
    ...(typeof record.descriptorId === 'string' ? { descriptorId: record.descriptorId } : {}),
  };
}

/** Map ViewMetadata filters onto ObjectQuery Predicate (supported ops only). */
export function predicatesFromViewFilters(filters: readonly ViewFilter[]): Predicate[] {
  const out: Predicate[] = [];
  for (const filter of filters) {
    switch (filter.op) {
      case 'eq':
        out.push({ kind: 'eq', field: filter.fieldKey, value: (filter.value ?? null) as JsonValue });
        break;
      case 'neq':
        out.push({ kind: 'not_eq', field: filter.fieldKey, value: (filter.value ?? null) as JsonValue });
        break;
      case 'contains':
        out.push({ kind: 'contains', field: filter.fieldKey, value: (filter.value ?? '') as JsonValue });
        break;
      case 'is_empty':
        out.push({ kind: 'not', predicate: { kind: 'exists', field: filter.fieldKey } });
        break;
      case 'is_not_empty':
        out.push({ kind: 'exists', field: filter.fieldKey });
        break;
      default:
        // gt/gte/lt/lte/in require generated-tool filter args; skip at ObjectQuery layer.
        break;
    }
  }
  return out;
}

/** Map ViewMetadata sorts onto ObjectQuery rankers. */
export function rankersFromViewSorts(sorts: readonly ViewSort[]): Ranker[] {
  return sorts.map((sort) => ({
    kind: 'field' as const,
    field: sort.fieldKey,
    direction: sort.direction,
  }));
}

/** Equality filters suitable as aggregate_{plural} top-level filter args. */
export function aggregateFiltersFromView(filters: readonly ViewFilter[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const filter of filters) {
    if (filter.op === 'eq' && filter.value !== undefined) {
      out[filter.fieldKey] = filter.value;
    }
  }
  return out;
}

function propertyBag(sources: readonly (ObjectRef | undefined)[]): Record<string, JsonValue> {
  for (const source of sources) {
    if (source?.properties && typeof source.properties === 'object') {
      return source.properties as Record<string, JsonValue>;
    }
  }
  return {};
}

/** Extract declared schema context from an ObjectSet, shape, or view instance. */
export function extractRecordSchemaContext(
  set: ObjectSet,
  instance?: ObjectRef,
): RecordSchemaContext | null {
  const props = propertyBag([instance, set.objects[0]]);
  const objectTypeKey = typeof props.objectTypeKey === 'string'
    ? props.objectTypeKey
    : typeof props.object_type_key === 'string'
      ? props.object_type_key
      : typeof props.objectType === 'string'
        ? props.objectType
        : undefined;

  const rawFields = readJsonArray(props.declaredFields ?? props.fields ?? props.schemaFields);
  const rawViews = readJsonArray(props.views);
  const rawObjectType = props.objectTypeMetadata ?? props.object_type ?? props.objectType;

  let objectType = parseObjectType(rawObjectType);
  const objectTypeId = objectType?.id ?? objectTypeKey ?? 'record';

  if (!objectType && objectTypeKey) {
    objectType = {
      id: objectTypeKey,
      key: objectTypeKey,
      label: objectTypeKey,
      enforcement: 'observe',
      nameSingular: objectTypeKey,
      namePlural: `${objectTypeKey}s`,
      labelIdentifierField: typeof props.labelIdentifierField === 'string'
        ? props.labelIdentifierField
        : 'title',
      system: false,
      contentAnchor: '',
    };
  }

  const fields = rawFields
    .map((entry) => parseFieldMetadata(entry, objectTypeId))
    .filter((entry): entry is FieldMetadata => entry !== undefined);

  if (fields.length === 0 && set.shape.fields.length > 0 && objectType) {
    const synthesized = set.shape.fields
      .filter((key) => key !== 'utility')
      .map((key) => ({
        id: `${objectTypeId}:${key}`,
        objectTypeId,
        key,
        label: key,
        fieldType: parseFieldType(undefined),
        required: false,
      }));
    if (synthesized.length > 0) {
      return {
        objectTypeKey,
        objectType,
        fields: synthesized,
        views: rawViews.map(parseViewMetadata).filter((entry): entry is ViewMetadata => entry !== undefined),
        activeViewId: typeof props.activeViewId === 'string' ? props.activeViewId : undefined,
      };
    }
  }

  if (!objectType || fields.length === 0) return null;

  return {
    objectTypeKey,
    objectType,
    fields,
    views: rawViews.map(parseViewMetadata).filter((entry): entry is ViewMetadata => entry !== undefined),
    activeViewId: typeof props.activeViewId === 'string' ? props.activeViewId : undefined,
  };
}

export type AggregateOp =
  | 'count'
  | 'empty'
  | 'non_empty'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'earliest'
  | 'latest';

export function aggregateOpsForField(fieldType: FieldType): readonly AggregateOp[] {
  const base: AggregateOp[] = ['count', 'empty', 'non_empty'];
  if (fieldType.kind === 'number' || fieldType.kind === 'integer') {
    return [...base, 'sum', 'avg', 'min', 'max'];
  }
  if (fieldType.kind === 'date' || fieldType.kind === 'timestamp') {
    return [...base, 'earliest', 'latest'];
  }
  return base;
}
