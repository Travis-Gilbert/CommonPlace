// SOURCING: none. Named stand-in (`LocalDevDeclaredModelStore`) for the
// schema registry when the consumer data API is unconfigured. Oracle class is local
// process memory — not production evidence for live registry requirements.

import 'server-only';

import {
  emptyDeclaredModel,
  emptyObservedModel,
  type DeclaredModel,
  type FieldMetadata,
  type ObjectTypeMetadata,
  type ObservedModel,
  type RelationMetadata,
  type SchemaDeclareInput,
  type SchemaDeclareReceipt,
  type SchemaVersion,
  type ScopeRef,
} from '@commonplace/data-model-contracts';

const LOCAL_TENANT = 'local-dev';

type TopicBucket = {
  declared: DeclaredModel;
  observed: ObservedModel;
  versionSeq: number;
};

const buckets = new Map<string, TopicBucket>();

function scopeFor(topicId: string): ScopeRef {
  return { kind: 'topic', topicId, tenant: LOCAL_TENANT };
}

function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'object';
}

function uniqueKey(declared: DeclaredModel, base: string): string {
  if (!declared.objectTypes.some((type) => type.key === base)) return base;
  let n = 2;
  while (declared.objectTypes.some((type) => type.key === `${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

function starterDeclared(topicId: string): DeclaredModel {
  const scope = scopeFor(topicId);
  const customerId = 'ot:customer';
  const orderId = 'ot:order';
  const lineId = 'ot:order_line';
  const objectTypes: ObjectTypeMetadata[] = [
    {
      id: customerId,
      key: 'customer',
      label: 'Customer',
      nameSingular: 'customer',
      namePlural: 'customers',
      labelIdentifierField: 'id',
      nodeLabel: 'Customer',
      enforcement: 'warn',
      system: false,
      contentAnchor: 'local:customer:v1',
      provider: { kind: 'declared-record' },
      recordCount: 128,
    },
    {
      id: orderId,
      key: 'order',
      label: 'Order',
      nameSingular: 'order',
      namePlural: 'orders',
      labelIdentifierField: 'id',
      nodeLabel: 'Order',
      enforcement: 'warn',
      system: false,
      contentAnchor: 'local:order:v1',
      provider: { kind: 'declared-record' },
      recordCount: 412,
    },
    {
      id: lineId,
      key: 'order_line',
      label: 'Order line',
      nameSingular: 'order_line',
      namePlural: 'order_lines',
      labelIdentifierField: 'id',
      nodeLabel: 'Order line',
      enforcement: 'warn',
      system: false,
      contentAnchor: 'local:order_line:v1',
      provider: { kind: 'declared-record' },
      recordCount: 980,
    },
  ];
  const fields: FieldMetadata[] = [
    { id: 'f:customer:id', objectTypeId: customerId, key: 'id', label: 'Id', fieldType: { kind: 'uuid' }, required: true, system: true },
    { id: 'f:customer:email', objectTypeId: customerId, key: 'email', label: 'Email', fieldType: { kind: 'text' }, required: true },
    { id: 'f:customer:name', objectTypeId: customerId, key: 'name', label: 'Name', fieldType: { kind: 'text' }, required: false },
    { id: 'f:order:id', objectTypeId: orderId, key: 'id', label: 'Id', fieldType: { kind: 'uuid' }, required: true, system: true },
    { id: 'f:order:customer_id', objectTypeId: orderId, key: 'customer_id', label: 'Customer', fieldType: { kind: 'uuid' }, required: true },
    { id: 'f:order:total', objectTypeId: orderId, key: 'total', label: 'Total', fieldType: { kind: 'number' }, required: true },
    { id: 'f:order:placed_at', objectTypeId: orderId, key: 'placed_at', label: 'Placed at', fieldType: { kind: 'timestamp' }, required: true },
    { id: 'f:line:id', objectTypeId: lineId, key: 'id', label: 'Id', fieldType: { kind: 'uuid' }, required: true, system: true },
    { id: 'f:line:order_id', objectTypeId: lineId, key: 'order_id', label: 'Order', fieldType: { kind: 'uuid' }, required: true },
    { id: 'f:line:sku', objectTypeId: lineId, key: 'sku', label: 'SKU', fieldType: { kind: 'text' }, required: true },
    { id: 'f:line:qty', objectTypeId: lineId, key: 'qty', label: 'Qty', fieldType: { kind: 'integer' }, required: true },
  ];
  const relations: RelationMetadata[] = [
    {
      id: 'rel:order-customer',
      objectTypeId: orderId,
      key: 'customer',
      label: 'Customer',
      edge: 'BELONGS_TO',
      direction: 'out',
      targetObjectTypeId: customerId,
    },
    {
      id: 'rel:line-order',
      objectTypeId: lineId,
      key: 'order',
      label: 'Order',
      edge: 'BELONGS_TO',
      direction: 'out',
      targetObjectTypeId: orderId,
    },
  ];
  const version: SchemaVersion = {
    id: 'sv:local:1',
    scope,
    version: 1,
    status: 'declared',
    contentAnchor: 'local:starter:v1',
    objectTypeIds: objectTypes.map((type) => type.id),
    fieldIds: fields.map((field) => field.id),
    relationIds: relations.map((relation) => relation.id),
    viewIds: [],
    createdAt: new Date().toISOString(),
    objectTypes,
    fields,
    relations,
  };
  return {
    scope,
    objectTypes,
    fields,
    relations,
    views: [],
    versions: [version],
    divergences: [],
  };
}

function ensureBucket(topicId: string): TopicBucket {
  const existing = buckets.get(topicId);
  if (existing) return existing;
  const declared = starterDeclared(topicId);
  const bucket: TopicBucket = {
    declared,
    observed: emptyObservedModel(scopeFor(topicId)),
    versionSeq: 1,
  };
  buckets.set(topicId, bucket);
  return bucket;
}

export function localDevTenant(): string {
  return LOCAL_TENANT;
}

export function readLocalDevModels(topicId: string): {
  readonly tenant: string;
  readonly observed: ObservedModel;
  readonly declared: DeclaredModel;
} {
  const bucket = ensureBucket(topicId);
  return {
    tenant: LOCAL_TENANT,
    observed: bucket.observed,
    declared: bucket.declared,
  };
}

export function declareLocalDevSchema(
  topicId: string,
  input: SchemaDeclareInput,
): {
  readonly tenant: string;
  readonly receipt: SchemaDeclareReceipt;
  readonly declared: DeclaredModel;
} {
  const bucket = ensureBucket(topicId);
  const key = uniqueKey(bucket.declared, slugify(input.nameSingular || input.labelSingular));
  const objectTypeId = `ot:${key}`;
  const contentAnchor = `local:${key}:v${bucket.versionSeq + 1}`;
  const objectType: ObjectTypeMetadata = {
    id: objectTypeId,
    key,
    label: input.labelSingular || input.nameSingular || key,
    description: input.description,
    nodeLabel: input.nodeLabel || input.labelSingular || key,
    enforcement: input.enforcement,
    nameSingular: input.nameSingular || key,
    namePlural: input.namePlural || `${key}s`,
    labelIdentifierField: input.labelIdentifierField || input.fields[0]?.key || 'id',
    system: input.system,
    contentAnchor,
    provider: { kind: 'declared-record' },
  };
  const fields: FieldMetadata[] = input.fields.map((field) => ({
    id: `f:${key}:${field.key}`,
    objectTypeId,
    key: field.key,
    label: field.label,
    ...(field.description ? { description: field.description } : {}),
    fieldType: field.fieldType,
    required: field.required,
    system: field.system,
  }));

  const prior = bucket.declared.objectTypes.find((type) => type.key === key);
  const objectTypes = prior
    ? bucket.declared.objectTypes.map((type) => (type.id === prior.id ? { ...objectType, id: prior.id } : type))
    : [...bucket.declared.objectTypes, objectType];
  const resolvedId = prior?.id ?? objectTypeId;
  const nextFields = [
    ...bucket.declared.fields.filter((field) => field.objectTypeId !== resolvedId),
    ...fields.map((field) => ({ ...field, objectTypeId: resolvedId, id: `f:${key}:${field.key}` })),
  ];
  const nextObjectTypes = objectTypes.map((type) =>
    type.id === resolvedId ? { ...objectType, id: resolvedId } : type,
  );

  bucket.versionSeq += 1;
  const version: SchemaVersion = {
    id: `sv:local:${bucket.versionSeq}`,
    scope: scopeFor(topicId),
    version: bucket.versionSeq,
    status: 'declared',
    contentAnchor,
    objectTypeIds: nextObjectTypes.map((type) => type.id),
    fieldIds: nextFields.map((field) => field.id),
    relationIds: bucket.declared.relations.map((relation) => relation.id),
    viewIds: [],
    createdAt: new Date().toISOString(),
    objectTypes: nextObjectTypes,
    fields: nextFields,
    relations: bucket.declared.relations,
  };
  const declared: DeclaredModel = {
    ...bucket.declared,
    objectTypes: nextObjectTypes,
    fields: nextFields,
    versions: [
      ...bucket.declared.versions.map((row) =>
        row.status === 'declared' ? { ...row, status: 'superseded' as const } : row,
      ),
      version,
    ],
  };
  bucket.declared = declared;
  return {
    tenant: LOCAL_TENANT,
    receipt: {
      status: 'declared',
      idempotentReplay: false,
      objectTypeId: resolvedId,
      graphVersionAfter: bucket.versionSeq,
    },
    declared,
  };
}

export function unpinLocalDevDeclared(
  topicId: string,
  declaredId: string,
): {
  readonly tenant: string;
  readonly declared: DeclaredModel;
} {
  const bucket = ensureBucket(topicId);
  const objectTypes = bucket.declared.objectTypes.filter((type) => type.id !== declaredId);
  const fields = bucket.declared.fields.filter((field) => field.objectTypeId !== declaredId);
  const relations = bucket.declared.relations.filter(
    (relation) =>
      relation.id !== declaredId
      && relation.objectTypeId !== declaredId
      && relation.targetObjectTypeId !== declaredId,
  );
  bucket.versionSeq += 1;
  const version: SchemaVersion = {
    id: `sv:local:${bucket.versionSeq}`,
    scope: scopeFor(topicId),
    version: bucket.versionSeq,
    status: 'declared',
    contentAnchor: `local:unpin:${bucket.versionSeq}`,
    objectTypeIds: objectTypes.map((type) => type.id),
    fieldIds: fields.map((field) => field.id),
    relationIds: relations.map((relation) => relation.id),
    viewIds: [],
    createdAt: new Date().toISOString(),
    objectTypes,
    fields,
    relations,
  };
  bucket.declared = {
    ...bucket.declared,
    objectTypes,
    fields,
    relations,
    versions: [
      ...bucket.declared.versions.map((row) =>
        row.status === 'declared' ? { ...row, status: 'superseded' as const } : row,
      ),
      version,
    ],
  };
  return { tenant: LOCAL_TENANT, declared: bucket.declared };
}

/** Test-only: drop all local topics. */
export function resetLocalDevDeclaredModelStore(): void {
  buckets.clear();
}

export function emptyLocalDevDeclared(topicId: string): DeclaredModel {
  return emptyDeclaredModel(scopeFor(topicId));
}
