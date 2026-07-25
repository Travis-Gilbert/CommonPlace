// SOURCING: none. Server-only GraphQL adapter for observed and declared model metadata.

import 'server-only';

import {
  emptyObservedModel,
  type DeclaredModel,
  type FieldMetadata,
  type MetadataProvenance,
  type ObjectTypeMetadata,
  type ObservedEdge,
  type ObservedField,
  type ObservedModel,
  type ObservedType,
  type PinReceipt,
  type PinRequest,
  type RelationMetadata,
  type SchemaProposalDraft,
  type SchemaVersion,
  type ScopeRef,
  type ViewMetadata,
} from '@commonplace/data-model-contracts';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

interface GraphqlSuccess {
  readonly ok: true;
  readonly tenant: string;
  readonly data: Record<string, unknown>;
}

interface GraphqlFailure {
  readonly ok: false;
  readonly status: number;
  readonly error: string;
}

type GraphqlResult = GraphqlSuccess | GraphqlFailure;

export type ModelRead =
  | {
      readonly ok: true;
      readonly tenant: string;
      readonly observed: ObservedModel;
      readonly declared: DeclaredModel;
    }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly observed: ObservedModel;
      readonly declared: DeclaredModel;
    };

export type ModelMutation =
  | {
      readonly ok: true;
      readonly tenant: string;
      readonly receipt: PinReceipt;
      readonly declared: DeclaredModel;
    }
  | GraphqlFailure;

export type ProposalMutation =
  | { readonly ok: true; readonly tenant: string; readonly draft: SchemaProposalDraft }
  | GraphqlFailure;

export type CompileMutation =
  | { readonly ok: true; readonly tenant: string; readonly value: unknown }
  | GraphqlFailure;

const MODELS_QUERY = `
  query ConsoleObservedAndDeclaredModel($topicId: String!) {
    observedModel(topicId: $topicId)
    declaredModel(topicId: $topicId)
  }
`;

const DECLARED_QUERY = `
  query ConsoleDeclaredModel($topicId: String!) {
    declaredModel(topicId: $topicId)
  }
`;

const PIN_MUTATION = `
  mutation ConsolePinObserved($input: JSON!) {
    pinObserved(input: $input)
  }
`;

const UNPIN_MUTATION = `
  mutation ConsoleUnpinDeclared($targetId: String!) {
    unpinDeclared(targetId: $targetId)
  }
`;

const PROPOSE_MUTATION = `
  mutation ConsoleProposeSchemaChange($input: SchemaChangeInput!) {
    proposeSchemaChange(input: $input)
  }
`;

const COMPILE_MUTATION = `
  query ConsoleCompileDeclaredModel($topicId: String!) {
    compileDeclaredModel(topicId: $topicId)
  }
`;

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function sourceValue(value: Record<string, unknown>, camel: string, snake: string): unknown {
  return value[camel] ?? value[snake];
}

function scopeFor(topicId: string, tenant?: string): ScopeRef {
  return { kind: 'topic', topicId, ...(tenant ? { tenant } : {}) };
}

function emptyDeclaredModel(scope: ScopeRef): DeclaredModel {
  return {
    scope,
    objectTypes: [],
    fields: [],
    relations: [],
    views: [],
    versions: [],
  };
}

function normalizeObservedField(value: unknown, dataType: string): ObservedField | null {
  const source = record(value);
  if (!source) return null;
  const key = text(source.key);
  if (!key) return null;
  return {
    observedKey: text(sourceValue(source, 'observedKey', 'observed_key'), `${dataType}.${key}`),
    key,
    fieldType: text(sourceValue(source, 'fieldType', 'field_type'), 'unknown'),
    indexPolicy: sourceValue(source, 'indexPolicy', 'index_policy') ?? null,
    origin: text(source.origin, 'observed'),
    occurrences: numberValue(source.occurrences),
    coverage: numberValue(source.coverage),
    sampleValues: list(sourceValue(source, 'sampleValues', 'sample_values')),
    eventIds: stringList(sourceValue(source, 'eventIds', 'event_ids')),
    sourceRefs: stringList(sourceValue(source, 'sourceRefs', 'source_refs')),
    routeDecision: sourceValue(source, 'routeDecision', 'route_decision'),
    provenanceNodeId: text(sourceValue(source, 'provenanceNodeId', 'provenance_node_id')) || undefined,
  };
}

function normalizeObservedEdge(value: unknown, dataType: string): ObservedEdge | null {
  const source = record(value);
  if (!source) return null;
  const label = text(source.label);
  const fromField = text(sourceValue(source, 'fromField', 'from_field'));
  const toField = text(sourceValue(source, 'toField', 'to_field'));
  if (!label) return null;
  const cardinality = record(sourceValue(source, 'observedCardinality', 'observed_cardinality'));
  return {
    observedKey: text(
      sourceValue(source, 'observedKey', 'observed_key'),
      `${dataType}.${label}:${fromField}:${toField}`,
    ),
    label,
    fromField,
    toField,
    occurrences: numberValue(source.occurrences),
    observedCardinality: {
      maxOut: numberValue(cardinality ? sourceValue(cardinality, 'maxOut', 'max_out') : 0),
      maxIn: numberValue(cardinality ? sourceValue(cardinality, 'maxIn', 'max_in') : 0),
    },
    eventIds: stringList(sourceValue(source, 'eventIds', 'event_ids')),
    sourceRefs: stringList(sourceValue(source, 'sourceRefs', 'source_refs')),
    routeDecision: sourceValue(source, 'routeDecision', 'route_decision'),
    provenanceNodeId: text(sourceValue(source, 'provenanceNodeId', 'provenance_node_id')) || undefined,
  };
}

function normalizeObservedType(value: unknown): ObservedType | null {
  const source = record(value);
  if (!source) return null;
  const dataType = text(sourceValue(source, 'dataType', 'data_type'));
  if (!dataType) return null;
  return {
    observedKey: text(sourceValue(source, 'observedKey', 'observed_key'), dataType),
    dataType,
    eventCount: numberValue(sourceValue(source, 'eventCount', 'event_count')),
    fields: list(source.fields)
      .map((field) => normalizeObservedField(field, dataType))
      .filter((field): field is ObservedField => field !== null),
    edges: list(source.edges)
      .map((edge) => normalizeObservedEdge(edge, dataType))
      .filter((edge): edge is ObservedEdge => edge !== null),
    eventIds: stringList(sourceValue(source, 'eventIds', 'event_ids')),
    sourceRefs: stringList(sourceValue(source, 'sourceRefs', 'source_refs')),
    provenanceNodeId: text(sourceValue(source, 'provenanceNodeId', 'provenance_node_id')) || undefined,
  };
}

function normalizeObservedModel(value: unknown, topicId: string, tenant: string): ObservedModel {
  const scope = scopeFor(topicId, tenant);
  const source = record(value);
  if (!source) return emptyObservedModel(scope);
  return {
    scope,
    eventCount: numberValue(sourceValue(source, 'eventCount', 'event_count')),
    types: list(source.types)
      .map(normalizeObservedType)
      .filter((type): type is ObservedType => type !== null),
    sources: stringList(source.sources),
  };
}

function normalizeProvenance(value: unknown): MetadataProvenance | undefined {
  const source = record(value);
  if (!source) return undefined;
  const observedKey = text(
    sourceValue(source, 'observedKey', 'observed_key')
      ?? sourceValue(source, 'observedIdentity', 'observed_identity'),
  );
  if (!observedKey) return undefined;
  return {
    observedKey,
    nodeId: text(sourceValue(source, 'nodeId', 'node_id')) || undefined,
    eventIds: stringList(sourceValue(source, 'eventIds', 'event_ids')),
    sourceRefs: stringList(sourceValue(source, 'sourceRefs', 'source_refs')),
  };
}

function normalizeMetadataProvenance(source: Record<string, unknown>): MetadataProvenance | undefined {
  const provenance = normalizeProvenance(source.provenance);
  if (!provenance) return undefined;
  const nodeId = provenance.nodeId ?? text(source.id);
  return {
    ...provenance,
    ...(nodeId ? { nodeId } : {}),
  };
}

function normalizeObjectType(value: unknown): ObjectTypeMetadata | null {
  const source = record(value);
  if (!source) return null;
  const id = text(source.id);
  const key = text(source.key ?? source.name ?? sourceValue(source, 'dataType', 'data_type'));
  if (!id || !key) return null;
  return {
    id,
    key,
    label: text(source.label ?? source.name, key),
    provenance: normalizeMetadataProvenance(source),
  };
}

function normalizeField(value: unknown): FieldMetadata | null {
  const source = record(value);
  if (!source) return null;
  const id = text(source.id);
  const key = text(source.key);
  const objectTypeId = text(sourceValue(source, 'objectTypeId', 'object_type_id'));
  if (!id || !key || !objectTypeId) return null;
  return {
    id,
    objectTypeId,
    key,
    label: text(source.label, key),
    fieldType: text(sourceValue(source, 'fieldType', 'field_type'), 'unknown'),
    indexPolicy: sourceValue(source, 'indexPolicy', 'index_policy'),
    provenance: normalizeMetadataProvenance(source),
  };
}

function normalizeRelation(value: unknown): RelationMetadata | null {
  const source = record(value);
  if (!source) return null;
  const id = text(source.id);
  const key = text(source.key ?? source.label);
  const objectTypeId = text(sourceValue(source, 'objectTypeId', 'object_type_id'));
  if (!id || !key || !objectTypeId) return null;
  const direction = source.direction === 'in' ? 'in' : 'out';
  return {
    id,
    objectTypeId,
    key,
    label: text(source.label, key),
    edge: text(source.edge ?? source.label, key),
    direction,
    targetObjectTypeId: text(sourceValue(source, 'targetObjectTypeId', 'target_object_type_id')) || undefined,
    provenance: normalizeMetadataProvenance(source),
  };
}

function normalizeView(value: unknown): ViewMetadata | null {
  const source = record(value);
  if (!source) return null;
  const id = text(source.id);
  const key = text(source.key);
  if (!id || !key) return null;
  return {
    id,
    key,
    label: text(source.label, key),
    descriptorId: text(sourceValue(source, 'descriptorId', 'descriptor_id')) || undefined,
    provenance: normalizeMetadataProvenance(source),
  };
}

function normalizeVersion(value: unknown, scope: ScopeRef): SchemaVersion | null {
  const source = record(value);
  if (!source) return null;
  const id = text(source.id);
  if (!id) return null;
  const rawStatus = text(source.status);
  const status = rawStatus === 'declared'
    || rawStatus === 'published'
    || rawStatus === 'superseded'
    ? rawStatus
    : 'draft';
  return {
    id,
    scope,
    version: typeof source.version === 'string' || typeof source.version === 'number'
      ? source.version
      : 0,
    status,
    objectTypeIds: stringList(sourceValue(source, 'objectTypeIds', 'object_type_ids')),
    fieldIds: stringList(sourceValue(source, 'fieldIds', 'field_ids')),
    relationIds: stringList(sourceValue(source, 'relationIds', 'relation_ids')),
    viewIds: stringList(sourceValue(source, 'viewIds', 'view_ids')),
    createdAt: text(sourceValue(source, 'createdAt', 'created_at')) || undefined,
    request: text(source.request) || undefined,
    validationSummary: text(sourceValue(source, 'validationSummary', 'validation_summary')) || undefined,
    impactSummary: text(sourceValue(source, 'impactSummary', 'impact_summary')) || undefined,
  };
}

function normalizeDeclaredModel(value: unknown, topicId: string, tenant: string): DeclaredModel {
  const scope = scopeFor(topicId, tenant);
  const source = record(value);
  if (!source) return emptyDeclaredModel(scope);
  const rawObjectTypes = list(sourceValue(source, 'objectTypes', 'object_types'));
  const objectTypes = rawObjectTypes
    .map(normalizeObjectType)
    .filter((item): item is ObjectTypeMetadata => item !== null);
  const fields = rawObjectTypes.flatMap((objectType) => {
    const value = record(objectType);
    return list(value?.fields);
  }).map(normalizeField).filter((item): item is FieldMetadata => item !== null);
  const relationValues = rawObjectTypes.flatMap((objectType) => {
    const item = record(objectType);
    return list(item?.relations);
  });
  const objectTypeIdByKey = new Map(
    objectTypes.flatMap((item) => [
      [item.key, item.id] as const,
      ...(item.provenance?.observedKey
        ? [[item.provenance.observedKey, item.id] as const]
        : []),
    ]),
  );
  const relations = relationValues.flatMap((value) => {
      const item = normalizeRelation(value);
      if (!item) return [];
      const raw = record(value);
      const targetKey = text(sourceValue(raw ?? {}, 'targetDataType', 'target_data_type'));
      const normalized = targetKey && objectTypeIdByKey.has(targetKey)
        ? { ...item, targetObjectTypeId: objectTypeIdByKey.get(targetKey) }
        : item;
      return [normalized];
    });
  const schemaVersion = sourceValue(source, 'schemaVersion', 'schema_version');
  const normalizedVersion = normalizeVersion(schemaVersion, scope);
  return {
    scope,
    objectTypes,
    fields,
    relations,
    views: list(source.views).map(normalizeView).filter((item): item is ViewMetadata => item !== null),
    versions: normalizedVersion ? [normalizedVersion] : [],
  };
}

function normalizeReceipt(value: unknown): PinReceipt | null {
  const source = record(value);
  if (!source) return null;
  const action = text(sourceValue(source, 'actionKind', 'action_kind'));
  const statusValue = text(source.status);
  const actionKind = action.includes('unpin') ? 'unpin' : action.includes('compile') ? 'compile' : 'pin';
  const status = statusValue === 'accepted'
    || statusValue === 'unchanged'
    || statusValue === 'refused'
    ? statusValue
    : 'applied';
  return {
    actionKind,
    status,
    targetIds: stringList(sourceValue(source, 'targetIds', 'target_ids')),
    note: text(source.note) || undefined,
  };
}

function normalizePin(value: unknown, scope: ScopeRef): PinRequest | null {
  const source = record(value);
  if (!source) return null;
  const observedKey = text(
    sourceValue(source, 'observedKey', 'observed_key')
      ?? sourceValue(source, 'observedIdentity', 'observed_identity'),
  );
  const rawKind = text(source.kind);
  const kind = rawKind === 'relation' ? 'edge' : rawKind;
  if (!observedKey || !['type', 'field', 'edge'].includes(kind)) return null;
  const dataType = text(sourceValue(source, 'dataType', 'data_type'));
  return {
    scope,
    observedKey,
    kind: kind as PinRequest['kind'],
    parentObservedKey: text(
      sourceValue(source, 'parentObservedKey', 'parent_observed_key'),
      dataType,
    ) || undefined,
  };
}

function normalizeProposal(value: unknown, topicId: string, tenant: string): SchemaProposalDraft | null {
  const source = record(value);
  if (!source) return null;
  const scope = scopeFor(topicId, tenant);
  const id = text(source.id);
  const request = text(source.request);
  if (!id || !request) return null;
  const validation = record(source.validation);
  const impact = record(source.impact);
  const errors = list(validation?.errors).map((error) => text(error)).filter(Boolean);
  const warnings = list(validation?.warnings).map((warning) => text(warning)).filter(Boolean);
  const validationSummary = validation?.valid === true
    ? `Valid proposal with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`
    : `Proposal has ${errors.length} validation error${errors.length === 1 ? '' : 's'}.`;
  const proposedPinCount = numberValue(
    sourceValue(impact ?? {}, 'proposedPinCount', 'proposed_pin_count'),
  );
  const observedEventCount = numberValue(
    sourceValue(impact ?? {}, 'observedEventCount', 'observed_event_count'),
  );
  return {
    id,
    scope,
    request,
    proposedPins: list(sourceValue(source, 'proposedPins', 'proposed_pins'))
      .map((pin) => normalizePin(pin, scope))
      .filter((pin): pin is PinRequest => pin !== null),
    validationSummary,
    impactSummary: `${proposedPinCount} proposed pins across ${observedEventCount} observed events.`,
    status: 'draft',
  };
}

async function executeGraphql(
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphqlResult> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'observed_model_graphql_unconfigured' };

  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
    } | null;
    if (!upstream.ok || payload?.errors || !payload?.data) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: typeof detail === 'string' ? detail : 'observed_model_graphql_failed',
      };
    }
    return { ok: true, tenant: resolution.principal.tenant, data: payload.data };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'observed_model_graphql_timeout' : 'observed_model_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}

async function readDeclaredModel(topicId: string): Promise<
  | { readonly ok: true; readonly tenant: string; readonly declared: DeclaredModel }
  | GraphqlFailure
> {
  const result = await executeGraphql(DECLARED_QUERY, { topicId });
  if (!result.ok) return result;
  return {
    ok: true,
    tenant: result.tenant,
    declared: normalizeDeclaredModel(result.data.declaredModel, topicId, result.tenant),
  };
}

export async function readObservedModels(topicId: string): Promise<ModelRead> {
  const fallbackScope = scopeFor(topicId);
  const result = await executeGraphql(MODELS_QUERY, { topicId });
  if (!result.ok) {
    return {
      ...result,
      observed: emptyObservedModel(fallbackScope),
      declared: emptyDeclaredModel(fallbackScope),
    };
  }
  return {
    ok: true,
    tenant: result.tenant,
    observed: normalizeObservedModel(result.data.observedModel, topicId, result.tenant),
    declared: normalizeDeclaredModel(result.data.declaredModel, topicId, result.tenant),
  };
}

export async function pinObserved(request: PinRequest): Promise<ModelMutation> {
  if (request.scope.kind !== 'topic') {
    return { ok: false, status: 400, error: 'pin_requires_topic_scope' };
  }
  const dataType = request.parentObservedKey ?? request.observedKey.split('.')[0] ?? '';
  const input: Record<string, unknown> = {
    topic_id: request.scope.topicId,
    kind: request.kind === 'edge' ? 'relation' : request.kind,
    data_type: dataType,
  };
  if (request.kind === 'field') {
    const prefix = `${dataType}.`;
    input.key = request.observedKey.startsWith(prefix)
      ? request.observedKey.slice(prefix.length)
      : request.observedKey;
  }
  if (request.kind === 'edge') {
    const prefix = `${dataType}.`;
    const identity = request.observedKey.startsWith(prefix)
      ? request.observedKey.slice(prefix.length)
      : request.observedKey;
    const [label, fromField, toField] = identity.split(':');
    if (!label || !fromField || !toField) {
      return { ok: false, status: 400, error: 'invalid_observed_relation_identity' };
    }
    input.label = label;
    input.from_field = fromField;
    input.to_field = toField;
  }
  const mutation = await executeGraphql(PIN_MUTATION, { input });
  if (!mutation.ok) return mutation;
  const receipt = normalizeReceipt(mutation.data.pinObserved);
  if (!receipt) return { ok: false, status: 502, error: 'invalid_pin_receipt' };
  const declared = await readDeclaredModel(request.scope.topicId);
  if (!declared.ok) return declared;
  return { ok: true, tenant: declared.tenant, receipt, declared: declared.declared };
}

export async function unpinDeclared(topicId: string, declaredId: string): Promise<ModelMutation> {
  const mutation = await executeGraphql(UNPIN_MUTATION, { targetId: declaredId });
  if (!mutation.ok) return mutation;
  const receipt = normalizeReceipt(mutation.data.unpinDeclared);
  if (!receipt) return { ok: false, status: 502, error: 'invalid_unpin_receipt' };
  const declared = await readDeclaredModel(topicId);
  if (!declared.ok) return declared;
  return { ok: true, tenant: declared.tenant, receipt, declared: declared.declared };
}

export async function proposeSchemaChange(
  topicId: string,
  request: string,
): Promise<ProposalMutation> {
  const mutation = await executeGraphql(PROPOSE_MUTATION, { input: { topicId, request } });
  if (!mutation.ok) return mutation;
  const draft = normalizeProposal(mutation.data.proposeSchemaChange, topicId, mutation.tenant);
  return draft
    ? { ok: true, tenant: mutation.tenant, draft }
    : { ok: false, status: 502, error: 'invalid_schema_proposal' };
}

export async function compileDeclaredModel(topicId: string): Promise<CompileMutation> {
  const mutation = await executeGraphql(COMPILE_MUTATION, { topicId });
  return mutation.ok
    ? { ok: true, tenant: mutation.tenant, value: mutation.data.compileDeclaredModel }
    : mutation;
}
