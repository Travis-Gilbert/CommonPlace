// SOURCING: none. Pure data contracts and formatting helpers.

export type ScopeRef =
  | { readonly kind: 'topic'; readonly topicId: string; readonly tenant?: string }
  | { readonly kind: 'tenant'; readonly tenant: string };

export interface ObservedCardinality {
  readonly maxOut: number;
  readonly maxIn: number;
}

export interface ObservedField {
  readonly observedKey: string;
  readonly key: string;
  readonly fieldType: string;
  readonly indexPolicy: unknown;
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
  readonly provenance?: MetadataProvenance;
}

export interface FieldMetadata {
  readonly id: string;
  readonly objectTypeId: string;
  readonly key: string;
  readonly label: string;
  readonly fieldType: string;
  readonly indexPolicy?: unknown;
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

export interface ViewMetadata {
  readonly id: string;
  readonly key: string;
  readonly label: string;
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
}

export interface DeclaredModel {
  readonly scope: ScopeRef;
  readonly objectTypes: readonly ObjectTypeMetadata[];
  readonly fields: readonly FieldMetadata[];
  readonly relations: readonly RelationMetadata[];
  readonly views: readonly ViewMetadata[];
  readonly versions: readonly SchemaVersion[];
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
