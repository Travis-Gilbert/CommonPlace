// SOURCING: none. Pure data contracts and formatting helpers.
// FieldType is generated from rustyred-thg-schema (MR1); do not widen to string.

export type {
  Cardinality,
  FieldType,
  FieldTypeKind,
  IndexPolicy,
} from './field-type.generated';
export {
  FIELD_TYPE_KINDS,
  INDEX_POLICY_NONE,
  formatFieldType,
  parseFieldType,
  parseIndexPolicy,
} from './field-type.generated';

import type { FieldType, IndexPolicy } from './field-type.generated';
import { INDEX_POLICY_NONE, parseFieldType, parseIndexPolicy } from './field-type.generated';

export type ScopeRef =
  | { readonly kind: 'topic'; readonly topicId: string; readonly tenant?: string }
  | { readonly kind: 'tenant'; readonly tenant: string };

export type Enforcement = 'observe' | 'warn' | 'reject';

export interface Divergence {
  readonly objectTypeId: string;
  readonly fieldKey?: string;
  readonly kind: 'missing-required' | 'type-mismatch' | 'unknown-key';
  readonly count: number;
  readonly signalNodeIds: readonly string[];
}

export interface ObservedCardinality {
  readonly maxOut: number;
  readonly maxIn: number;
}

export interface ObservedField {
  readonly observedKey: string;
  readonly key: string;
  readonly fieldType: FieldType;
  readonly indexPolicy: IndexPolicy;
  readonly origin: string;
  readonly occurrences: number;
  readonly coverage: number;
  readonly sampleValues: readonly unknown[];
  readonly eventIds?: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly routeDecision?: unknown;
  readonly provenanceNodeId?: string;
}

export interface ObservedEdge {
  readonly observedKey: string;
  readonly label: string;
  readonly fromField: string;
  readonly toField: string;
  readonly occurrences: number;
  readonly observedCardinality: ObservedCardinality;
  readonly eventIds?: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly routeDecision?: unknown;
  readonly provenanceNodeId?: string;
}

export interface ObservedType {
  readonly observedKey: string;
  readonly dataType: string;
  readonly eventCount: number;
  readonly fields: readonly ObservedField[];
  readonly edges: readonly ObservedEdge[];
  readonly eventIds?: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly provenanceNodeId?: string;
}

export interface ObservedModel {
  readonly scope: ScopeRef;
  readonly eventCount: number;
  readonly types: readonly ObservedType[];
  readonly sources: readonly string[];
}

export interface MetadataProvenance {
  readonly observedKey: string;
  readonly nodeId?: string;
  readonly eventIds?: readonly string[];
  readonly sourceRefs?: readonly string[];
}

export interface ObjectTypeMetadata {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly nodeLabel?: string;
  readonly enforcement: Enforcement;
  readonly nameSingular: string;
  readonly namePlural: string;
  readonly labelIdentifierField: string;
  readonly system: boolean;
  readonly contentAnchor: string;
  /** Live record count from MR10 dataModel; absent when the read omits counts. */
  readonly recordCount?: number;
  readonly icon?: string;
  readonly tint?: string;
  readonly provenance?: MetadataProvenance;
}

export interface FieldMetadata {
  readonly id: string;
  readonly objectTypeId: string;
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly system?: boolean;
  readonly indexPolicy?: IndexPolicy;
  readonly provenance?: MetadataProvenance;
}

export interface RelationMetadata {
  readonly id: string;
  readonly objectTypeId: string;
  readonly key: string;
  readonly label: string;
  readonly edge: string;
  readonly direction: 'in' | 'out';
  readonly targetObjectTypeId?: string;
  readonly provenance?: MetadataProvenance;
}

export type ViewFilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_empty'
  | 'is_not_empty'
  | 'in';

export interface ViewFilter {
  readonly fieldKey: string;
  readonly op: ViewFilterOp;
  readonly value?: unknown;
}

export interface ViewSort {
  readonly fieldKey: string;
  readonly direction: 'asc' | 'desc';
}

export interface ViewColumnConfig {
  readonly fieldKey: string;
  readonly visible: boolean;
  readonly width?: number;
  readonly order: number;
}

export interface ViewMetadata {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly objectTypeId: string;
  readonly filters: readonly ViewFilter[];
  readonly sorts: readonly ViewSort[];
  readonly columns: readonly ViewColumnConfig[];
  readonly isDefault?: boolean;
  readonly descriptorId?: string;
  readonly provenance?: MetadataProvenance;
}

export interface SchemaVersion {
  readonly id: string;
  readonly scope: ScopeRef;
  readonly version: string | number;
  readonly status: 'draft' | 'declared' | 'published' | 'superseded';
  readonly objectTypeIds: readonly string[];
  readonly fieldIds: readonly string[];
  readonly relationIds: readonly string[];
  readonly viewIds: readonly string[];
  readonly createdAt?: string;
  readonly request?: string;
  readonly validationSummary?: string;
  readonly impactSummary?: string;
  readonly objectTypes?: readonly ObjectTypeMetadata[];
  readonly fields?: readonly FieldMetadata[];
  readonly relations?: readonly RelationMetadata[];
}

export interface DeclaredModel {
  readonly scope: ScopeRef;
  readonly objectTypes: readonly ObjectTypeMetadata[];
  readonly fields: readonly FieldMetadata[];
  readonly relations: readonly RelationMetadata[];
  readonly views: readonly ViewMetadata[];
  readonly versions: readonly SchemaVersion[];
  readonly divergences: readonly Divergence[];
}

export type PinKind = 'type' | 'field' | 'edge';

export interface PinRequest {
  readonly scope: ScopeRef;
  readonly observedKey: string;
  readonly kind: PinKind;
  readonly parentObservedKey?: string;
}

export interface PinReceipt {
  readonly actionKind: 'pin' | 'unpin' | 'compile';
  readonly status: 'applied' | 'accepted' | 'unchanged' | 'refused';
  readonly targetIds: readonly string[];
  readonly note?: string;
}

export interface SchemaFieldInput {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly system: boolean;
}

export interface SchemaDeclareInput {
  readonly nameSingular: string;
  readonly namePlural: string;
  readonly labelSingular: string;
  readonly labelPlural: string;
  readonly description?: string;
  readonly nodeLabel: string;
  readonly labelIdentifierField: string;
  readonly fields: readonly SchemaFieldInput[];
  readonly enforcement: Enforcement;
  readonly system: boolean;
  readonly extensions?: Readonly<Record<string, unknown>>;
  readonly expectedContentAnchor?: string;
}

export interface SchemaDeclareReceipt {
  readonly status: 'declared' | 'conflict';
  readonly idempotentReplay: boolean;
  readonly objectTypeId: string;
  readonly graphVersionAfter: number;
  readonly conflict?: {
    readonly id: string;
    readonly existingAnchor: string;
    readonly requestedAnchor: string;
    readonly detail: string;
  };
}

export interface SchemaProposalDraft {
  readonly id: string;
  readonly scope: ScopeRef;
  readonly request: string;
  readonly proposedPins: readonly PinRequest[];
  readonly validationSummary: string;
  readonly impactSummary: string;
  readonly status: 'draft';
}

export function emptyObservedModel(scope: ScopeRef): ObservedModel {
  return {
    scope,
    eventCount: 0,
    types: [],
    sources: [],
  };
}

export function emptyDeclaredModel(scope: ScopeRef): DeclaredModel {
  return {
    scope,
    objectTypes: [],
    fields: [],
    relations: [],
    views: [],
    versions: [],
    divergences: [],
  };
}

export function isPinned(observedKey: string, declared: DeclaredModel): boolean {
  return [
    ...declared.objectTypes,
    ...declared.fields,
    ...declared.relations,
    ...declared.views,
  ].some((metadata) => metadata.provenance?.observedKey === observedKey);
}

export function formatCoverage(coverage: number, fractionDigits = 0): string {
  const normalized = Number.isFinite(coverage) ? Math.min(1, Math.max(0, coverage)) : 0;
  return `${(normalized * 100).toFixed(fractionDigits)}%`;
}

/** Normalize helpers used by harness adapters when mapping live GraphQL JSON. */
export function coerceObservedFieldType(value: unknown): FieldType {
  return parseFieldType(value, { kind: 'text' });
}

export function coerceIndexPolicy(value: unknown): IndexPolicy {
  return parseIndexPolicy(value) ?? INDEX_POLICY_NONE;
}
