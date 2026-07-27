// SOURCING: none. Generated wire types from rustyred-thg-schema FieldType.
// GENERATED FROM rustyred-thg-schema/src/field_type.rs
// Source: SPEC-THEOREM-SCHEMA-REGISTRY-1.0 SR2 + SPEC-MODEL-CANVAS-GRAPH-RECONCILIATION-1.0 MR1
// Do not hand-edit kinds. Regenerate from the Rust definition; CI fails on drift.

export type Cardinality = 'one' | 'many';

export type FieldType =
  | { readonly kind: 'text' }
  | { readonly kind: 'long_text' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'number' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'timestamp' }
  | { readonly kind: 'date' }
  | { readonly kind: 'uuid' }
  | { readonly kind: 'json' }
  | { readonly kind: 'enum'; readonly variants: readonly string[] }
  | { readonly kind: 'vector'; readonly dim: number }
  | { readonly kind: 'geometry' }
  | {
      readonly kind: 'relation';
      readonly targetObjectTypeId: string;
      readonly cardinality: Cardinality;
    }
  | { readonly kind: 'lc_text' }
  | { readonly kind: 'ip' }
  | { readonly kind: 'geo' }
  | { readonly kind: 'soundex' }
  | { readonly kind: 'metaphone' }
  | { readonly kind: 'noop' };

export interface IndexPolicy {
  readonly indexed: boolean;
  readonly reverseIndexed: boolean;
  readonly tokenized: boolean;
  readonly indexOnly: boolean;
}

export const INDEX_POLICY_NONE: IndexPolicy = {
  indexed: false,
  reverseIndexed: false,
  tokenized: false,
  indexOnly: false,
};

export const FIELD_TYPE_KINDS = [
  'text',
  'long_text',
  'integer',
  'number',
  'boolean',
  'timestamp',
  'date',
  'uuid',
  'json',
  'enum',
  'vector',
  'geometry',
  'relation',
  'lc_text',
  'ip',
  'geo',
  'soundex',
  'metaphone',
  'noop',
] as const;

export type FieldTypeKind = (typeof FIELD_TYPE_KINDS)[number];

const KIND_SET = new Set<string>(FIELD_TYPE_KINDS);

/** Parse wire FieldType from tagged objects or DATAWAVE snake_case strings. */
export function parseFieldType(value: unknown, fallback: FieldType = { kind: 'text' }): FieldType {
  if (typeof value === 'string') {
    const kind = value.trim().toLowerCase();
    if (!KIND_SET.has(kind)) return fallback;
    if (kind === 'enum') return { kind: 'enum', variants: [] };
    if (kind === 'vector') return { kind: 'vector', dim: 0 };
    if (kind === 'relation') {
      return { kind: 'relation', targetObjectTypeId: '', cardinality: 'one' };
    }
    return { kind: kind as Exclude<FieldTypeKind, 'enum' | 'vector' | 'relation'> };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  const kind = typeof record.kind === 'string' ? record.kind : '';
  if (!KIND_SET.has(kind)) return fallback;
  if (kind === 'enum') {
    const variants = Array.isArray(record.variants)
      ? record.variants.filter((item): item is string => typeof item === 'string')
      : [];
    return { kind: 'enum', variants };
  }
  if (kind === 'vector') {
    const dim = typeof record.dim === 'number' && Number.isFinite(record.dim) ? record.dim : 0;
    return { kind: 'vector', dim };
  }
  if (kind === 'relation') {
    const targetObjectTypeId = typeof record.targetObjectTypeId === 'string'
      ? record.targetObjectTypeId
      : typeof record.target_object_type_id === 'string'
        ? record.target_object_type_id
        : '';
    const cardinality = record.cardinality === 'many' ? 'many' : 'one';
    return { kind: 'relation', targetObjectTypeId, cardinality };
  }
  return { kind: kind as Exclude<FieldTypeKind, 'enum' | 'vector' | 'relation'> };
}

export function parseIndexPolicy(value: unknown): IndexPolicy {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return INDEX_POLICY_NONE;
  }
  const record = value as Record<string, unknown>;
  return {
    indexed: Boolean(record.indexed),
    reverseIndexed: Boolean(record.reverseIndexed ?? record.reverse_indexed),
    tokenized: Boolean(record.tokenized),
    indexOnly: Boolean(record.indexOnly ?? record.index_only),
  };
}

export function formatFieldType(fieldType: FieldType): string {
  switch (fieldType.kind) {
    case 'enum':
      return `enum(${fieldType.variants.join('|')})`;
    case 'vector':
      return `vector(${fieldType.dim})`;
    case 'relation':
      return `relation(${fieldType.cardinality}:${fieldType.targetObjectTypeId || '?'})`;
    default:
      return fieldType.kind;
  }
}
