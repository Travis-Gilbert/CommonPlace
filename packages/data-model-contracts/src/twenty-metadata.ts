// SOURCING: none. Twenty-shaped metadata wire (SPEC-COMMONPLACE-META-MODEL-1.0
// D2/D3). Presentation tokens are SCREAMING_SNAKE; canonical FieldType remains
// the tagged schema register in field-type.generated.ts.

import type { FieldType } from './field-type.generated';

/** Twenty `FieldMetadataType` wire tokens. */
export const TWENTY_FIELD_TYPE_TOKENS = [
  'ACTOR',
  'ADDRESS',
  'ARRAY',
  'BOOLEAN',
  'CURRENCY',
  'DATE',
  'DATE_TIME',
  'EMAILS',
  'FILES',
  'FULL_NAME',
  'LINKS',
  'MORPH_RELATION',
  'MULTI_SELECT',
  'NUMBER',
  'NUMERIC',
  'PHONES',
  'POSITION',
  'RATING',
  'RAW_JSON',
  'RELATION',
  'RICH_TEXT',
  'SELECT',
  'TEXT',
  'TS_VECTOR',
  'UUID',
] as const;

export type TwentyFieldTypeToken = (typeof TWENTY_FIELD_TYPE_TOKENS)[number];

/** Field types offered in the settings editor (excludes morph/rare). */
export const EDITOR_TWENTY_FIELD_TYPES: readonly TwentyFieldTypeToken[] = [
  'TEXT',
  'RICH_TEXT',
  'NUMBER',
  'NUMERIC',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'UUID',
  'SELECT',
  'MULTI_SELECT',
  'EMAILS',
  'PHONES',
  'LINKS',
  'CURRENCY',
  'RATING',
  'RAW_JSON',
  'RELATION',
  'ARRAY',
];

export type IndexKindWire = 'BTREE' | 'GIN' | 'VECTOR';

export type PromotionTriggerWire =
  | { readonly kind: 'facet_required'; readonly facet: string }
  | { readonly kind: 'user_marked' }
  | { readonly kind: 'observed'; readonly query_count: number; readonly window_ms: number };

export interface FieldSettingsWire {
  readonly isFilterable: boolean;
  readonly isSortable: boolean;
  readonly displayAs?: string;
  /** Canonical FieldType payload + IndexPolicy flags live here for settings editors. */
  readonly raw?: Readonly<Record<string, unknown>>;
}

export type IndexPolicyWire = {
  readonly indexed: boolean;
  readonly reverseIndexed: boolean;
  readonly tokenized: boolean;
  readonly indexOnly: boolean;
};

export function indexPolicyFromSettings(
  settings: FieldSettingsWire | undefined,
): IndexPolicyWire {
  const raw = settings?.raw ?? {};
  const policy = raw.indexPolicy;
  if (policy && typeof policy === 'object' && !Array.isArray(policy)) {
    const row = policy as Record<string, unknown>;
    return {
      indexed: row.indexed === true,
      reverseIndexed: row.reverseIndexed === true,
      tokenized: row.tokenized === true,
      indexOnly: row.indexOnly === true,
    };
  }
  return {
    indexed: false,
    reverseIndexed: false,
    tokenized: false,
    indexOnly: false,
  };
}

/** Build canonical FieldType from Twenty wire + tagged payload editors. */
export function fieldTypeFromEditor(input: {
  readonly token: TwentyFieldTypeToken;
  readonly variants?: readonly string[];
  readonly vectorDim?: number;
  readonly relationTarget?: string;
  readonly relationCardinality?: 'one' | 'many';
}): FieldType {
  const base = twentyTokenToFieldType(input.token);
  if (base.kind === 'enum') {
    return {
      kind: 'enum',
      variants: (input.variants ?? []).map((value) => value.trim()).filter(Boolean),
    };
  }
  if (input.token === 'RAW_JSON' && typeof input.vectorDim === 'number' && input.vectorDim > 0) {
    return { kind: 'vector', dim: input.vectorDim };
  }
  if (base.kind === 'relation') {
    return {
      kind: 'relation',
      targetObjectTypeId: (input.relationTarget ?? '*').trim() || '*',
      cardinality: input.relationCardinality ?? 'many',
    };
  }
  return base;
}

export function editorStateFromField(field: FieldMetadataWire): {
  token: TwentyFieldTypeToken;
  variants: string[];
  vectorDim: number;
  relationTarget: string;
  relationCardinality: 'one' | 'many';
  indexPolicy: IndexPolicyWire;
} {
  const raw = field.settings.raw ?? {};
  const canonical = raw.fieldType;
  let token = field.type;
  let variants = field.options.map((option) => option.value);
  let vectorDim = 0;
  let relationTarget = '*';
  let relationCardinality: 'one' | 'many' = 'many';
  if (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) {
    const typed = canonical as FieldType;
    // Keep the wire token when it already round-trips to the same canonical
    // kind, so compound tokens (MULTI_SELECT, EMAILS, CURRENCY) survive.
    token =
      twentyTokenToFieldType(field.type).kind === typed.kind
        ? field.type
        : fieldTypeToTwentyToken(typed);
    if (typed.kind === 'enum') variants = [...typed.variants];
    if (typed.kind === 'vector') {
      token = 'RAW_JSON';
      vectorDim = typed.dim;
    }
    if (typed.kind === 'relation') {
      relationTarget = typed.targetObjectTypeId;
      relationCardinality = typed.cardinality;
    }
  }
  return {
    token,
    variants,
    vectorDim,
    relationTarget,
    relationCardinality,
    indexPolicy: indexPolicyFromSettings(field.settings),
  };
}

export interface SelectOptionWire {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly color: string;
  readonly position: number;
}

export interface FieldMetadataWire {
  readonly id: string;
  readonly universalIdentifier: string;
  readonly type: TwentyFieldTypeToken;
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly isUiEditable: boolean;
  readonly isNullable: boolean;
  readonly isUnique: boolean;
  readonly defaultValue?: unknown;
  readonly options: readonly SelectOptionWire[];
  readonly settings: FieldSettingsWire;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface IndexFieldMetadataWire {
  readonly fieldMetadataId: string;
  readonly order: number;
}

export interface IndexMetadataWire {
  readonly id: string;
  readonly name: string;
  readonly indexType: IndexKindWire;
  readonly isUnique: boolean;
  readonly isCustom: boolean;
  readonly trigger: PromotionTriggerWire;
  readonly indexFieldMetadataList: readonly IndexFieldMetadataWire[];
  readonly createdAtMs: number;
}

export interface ObjectConformanceWire {
  readonly objectNameSingular: string;
  readonly facet: string;
  readonly propertyMap: Readonly<Record<string, string>>;
  readonly relationMap: Readonly<Record<string, string>>;
  readonly createdAtMs: number;
}

export interface ObjectMetadataWire {
  readonly id: string;
  readonly universalIdentifier: string;
  readonly nameSingular: string;
  readonly namePlural: string;
  readonly labelSingular: string;
  readonly labelPlural: string;
  readonly description?: string;
  readonly icon?: string;
  readonly color?: string;
  readonly isActive: boolean;
  readonly isSystem: boolean;
  readonly isUiEditable: boolean;
  readonly isUiCreatable: boolean;
  readonly isSearchable: boolean;
  readonly labelIdentifierFieldMetadataId?: string;
  readonly imageIdentifierFieldMetadataId?: string;
  readonly fields: readonly FieldMetadataWire[];
  readonly fieldsList?: readonly FieldMetadataWire[];
  readonly indexMetadataList: readonly IndexMetadataWire[];
  readonly conformances?: readonly ObjectConformanceWire[];
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface FacetPropertyWire {
  readonly name: string;
  readonly type: TwentyFieldTypeToken;
  readonly required: boolean;
  readonly unitDimension?: string;
}

export interface FacetDefWire {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly extends: readonly string[];
  readonly properties: readonly FacetPropertyWire[];
  readonly relations: readonly unknown[];
  readonly actions: readonly unknown[];
  readonly isSystem: boolean;
}

export interface PromotionCandidateWire {
  readonly objectNameSingular: string;
  readonly fieldName: string;
  readonly trigger: PromotionTriggerWire;
}

export function isTwentyFieldTypeToken(value: unknown): value is TwentyFieldTypeToken {
  return typeof value === 'string' && (TWENTY_FIELD_TYPE_TOKENS as readonly string[]).includes(value);
}

export function parseTwentyFieldTypeToken(
  value: unknown,
  fallback: TwentyFieldTypeToken = 'TEXT',
): TwentyFieldTypeToken {
  if (isTwentyFieldTypeToken(value)) return value;
  return fallback;
}

/** Presentation → canonical FieldType (lossy for compound Twenty types). */
export function twentyTokenToFieldType(token: TwentyFieldTypeToken): FieldType {
  switch (token) {
    case 'BOOLEAN':
      return { kind: 'boolean' };
    case 'NUMBER':
    case 'NUMERIC':
    case 'CURRENCY':
    case 'POSITION':
    case 'RATING':
      return { kind: 'number' };
    case 'DATE':
      return { kind: 'date' };
    case 'DATE_TIME':
      return { kind: 'timestamp' };
    case 'UUID':
      return { kind: 'uuid' };
    case 'RAW_JSON':
      return { kind: 'json' };
    case 'SELECT':
      return { kind: 'enum', variants: [] };
    case 'RELATION':
    case 'MORPH_RELATION':
      return { kind: 'relation', targetObjectTypeId: '*', cardinality: 'many' };
    case 'ARRAY':
    case 'MULTI_SELECT':
      return { kind: 'json' };
    default:
      return { kind: 'text' };
  }
}

/** Canonical FieldType → presentation token for settings editors. */
export function fieldTypeToTwentyToken(fieldType: FieldType): TwentyFieldTypeToken {
  switch (fieldType.kind) {
    case 'boolean':
      return 'BOOLEAN';
    case 'number':
    case 'integer':
      return 'NUMBER';
    case 'date':
      return 'DATE';
    case 'timestamp':
      return 'DATE_TIME';
    case 'uuid':
      return 'UUID';
    case 'json':
      return 'RAW_JSON';
    case 'enum':
      return 'SELECT';
    case 'relation':
      return 'RELATION';
    case 'vector':
      return 'RAW_JSON';
    case 'geometry':
      return 'RAW_JSON';
    case 'text':
    default:
      return 'TEXT';
  }
}

export function objectFields(meta: ObjectMetadataWire): readonly FieldMetadataWire[] {
  return meta.fieldsList?.length ? meta.fieldsList : meta.fields;
}
