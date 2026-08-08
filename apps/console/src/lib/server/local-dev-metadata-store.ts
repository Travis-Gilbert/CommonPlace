// SOURCING: none. Named stand-in (`LocalDevMetadataStore`) for Twenty-shaped
// `/rest/metadata/*` when the harness node is unreachable or unconfigured.
// Oracle class: local process memory — not production evidence.

import 'server-only';

import type {
  FacetDefWire,
  FieldMetadataWire,
  IndexMetadataWire,
  ObjectConformanceWire,
  ObjectMetadataWire,
  PromotionCandidateWire,
  TwentyFieldTypeToken,
} from '@commonplace/data-model-contracts';

type StoreState = {
  objects: Map<string, ObjectMetadataWire>;
  facets: Map<string, FacetDefWire>;
};

const globalKey = '__commonplace_local_dev_metadata_store__';

function state(): StoreState {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: StoreState;
  };
  if (!g[globalKey]) {
    g[globalKey] = seed();
  }
  return g[globalKey]!;
}

function now(): number {
  return Date.now();
}

function field(
  object: string,
  name: string,
  label: string,
  type: TwentyFieldTypeToken,
  opts: Partial<FieldMetadataWire> = {},
): FieldMetadataWire {
  const ts = now();
  return {
    id: `field:${object}:${name}`,
    universalIdentifier: `local.${object}.${name}`,
    type,
    name,
    label,
    isActive: true,
    isSystem: opts.isSystem ?? false,
    isUiEditable: opts.isUiEditable ?? true,
    isNullable: opts.isNullable ?? true,
    isUnique: opts.isUnique ?? false,
    options: [],
    settings: {
      isFilterable: opts.settings?.isFilterable ?? false,
      isSortable: opts.settings?.isSortable ?? false,
    },
    createdAtMs: ts,
    updatedAtMs: ts,
    ...opts,
  };
}

function seedObject(
  singular: string,
  plural: string,
  label: string,
  fields: FieldMetadataWire[],
): ObjectMetadataWire {
  const ts = now();
  return {
    id: `object:${singular}`,
    universalIdentifier: `local.${singular}`,
    nameSingular: singular,
    namePlural: plural,
    labelSingular: label,
    labelPlural: `${label}s`,
    isActive: true,
    isSystem: false,
    isUiEditable: true,
    isUiCreatable: true,
    isSearchable: true,
    fields,
    fieldsList: fields,
    indexMetadataList: [],
    conformances: [],
    createdAtMs: ts,
    updatedAtMs: ts,
  };
}

function seed(): StoreState {
  const customer = seedObject('customer', 'customers', 'Customer', [
    field('customer', 'id', 'Id', 'UUID', { isSystem: true, isNullable: false, isUnique: true }),
    field('customer', 'email', 'Email', 'EMAILS', {
      settings: { isFilterable: true, isSortable: true },
    }),
    field('customer', 'name', 'Name', 'TEXT', {
      settings: { isFilterable: true, isSortable: true },
    }),
  ]);
  const order = seedObject('order', 'orders', 'Order', [
    field('order', 'id', 'Id', 'UUID', { isSystem: true, isNullable: false, isUnique: true }),
    field('order', 'customer_id', 'Customer', 'UUID', {
      settings: { isFilterable: true, isSortable: false },
    }),
    field('order', 'total', 'Total', 'CURRENCY', {
      settings: { isFilterable: true, isSortable: true },
    }),
    field('order', 'placed_at', 'Placed at', 'DATE_TIME', {
      settings: { isFilterable: true, isSortable: true },
    }),
  ]);
  const publishable: FacetDefWire = {
    name: 'publishable',
    label: 'Publishable',
    description: 'Local-dev stand-in facet requiring a title-like property.',
    extends: [],
    properties: [{ name: 'title', type: 'TEXT', required: true }],
    relations: [],
    actions: [],
    isSystem: false,
  };
  const temporal: FacetDefWire = {
    name: 'temporal',
    label: 'Temporal',
    description: 'Local-dev stand-in facet for timestamp fields.',
    extends: [],
    properties: [{ name: 'occurred_at', type: 'DATE_TIME', required: true }],
    relations: [],
    actions: [],
    isSystem: true,
  };
  return {
    objects: new Map([
      [customer.nameSingular, customer],
      [order.nameSingular, order],
    ]),
    facets: new Map([
      [publishable.name, publishable],
      [temporal.name, temporal],
    ]),
  };
}

function withFieldsList(meta: ObjectMetadataWire): ObjectMetadataWire {
  return { ...meta, fieldsList: meta.fields };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function notFound(code: string, message: string): Response {
  return json(404, { error: code, message, source: 'LocalDevMetadataStore' });
}

function badRequest(code: string, message: string): Response {
  return json(400, { error: code, message, source: 'LocalDevMetadataStore' });
}

export function localDevMetadataSourceBanner(): Record<string, unknown> {
  return {
    source: 'LocalDevMetadataStore',
    oracle_class: 'local_process_memory',
    substitution_allowed: true,
    message:
      'Harness /rest/metadata unavailable; serving named local stand-in. Not production evidence.',
  };
}

/** Test-only: clear the process-global stand-in. */
export function resetLocalDevMetadataStore(): void {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: StoreState;
  };
  delete g[globalKey];
}

export async function handleLocalDevMetadata(
  method: string,
  segments: readonly string[],
  bodyText: string | null,
): Promise<Response> {
  const store = state();
  const verb = method.toUpperCase();
  let body: unknown = null;
  if (bodyText && bodyText.trim() !== '') {
    try {
      body = JSON.parse(bodyText) as unknown;
    } catch {
      return badRequest('invalid_json', 'Request body must be JSON.');
    }
  }

  // GET /rest/metadata/objects
  if (segments.length === 1 && segments[0] === 'objects' && verb === 'GET') {
    const edges = [...store.objects.values()].map((node) => ({
      node: {
        ...withFieldsList(node),
        conformances: node.conformances ?? [],
      },
    }));
    return json(200, { objects: { edges }, ...localDevMetadataSourceBanner() });
  }

  // POST /rest/metadata/objects
  if (segments.length === 1 && segments[0] === 'objects' && verb === 'POST') {
    const incoming = body as Partial<ObjectMetadataWire>;
    const singular = String(incoming.nameSingular ?? '').trim();
    if (!singular) return badRequest('name_singular_required', 'nameSingular is required');
    if (store.objects.has(singular)) {
      return json(409, { error: 'commonplace_metadata_exists', message: singular });
    }
    const ts = now();
    const created: ObjectMetadataWire = withFieldsList({
      id: `object:${singular}`,
      universalIdentifier: `local.${singular}`,
      nameSingular: singular,
      namePlural: String(incoming.namePlural ?? `${singular}s`),
      labelSingular: String(incoming.labelSingular ?? singular),
      labelPlural: String(incoming.labelPlural ?? `${singular}s`),
      description: incoming.description,
      isActive: incoming.isActive ?? true,
      isSystem: false,
      isUiEditable: true,
      isUiCreatable: true,
      isSearchable: incoming.isSearchable ?? true,
      fields: incoming.fields ?? [],
      indexMetadataList: [],
      conformances: [],
      createdAtMs: ts,
      updatedAtMs: ts,
    });
    store.objects.set(singular, created);
    return json(201, { ...created, ...localDevMetadataSourceBanner() });
  }

  // GET/PATCH/DELETE /rest/metadata/objects/:name
  if (segments.length === 2 && segments[0] === 'objects') {
    const name = segments[1]!;
    const existing = store.objects.get(name);
    if (!existing) return notFound('commonplace_metadata_missing', name);
    if (verb === 'GET') {
      return json(200, {
        ...withFieldsList(existing),
        conformances: existing.conformances ?? [],
        ...localDevMetadataSourceBanner(),
      });
    }
    if (verb === 'DELETE') {
      store.objects.delete(name);
      return new Response(null, { status: 204 });
    }
    if (verb === 'PATCH') {
      const patch = (body ?? {}) as Partial<ObjectMetadataWire>;
      const next: ObjectMetadataWire = withFieldsList({
        ...existing,
        labelSingular: patch.labelSingular ?? existing.labelSingular,
        labelPlural: patch.labelPlural ?? existing.labelPlural,
        description: patch.description ?? existing.description,
        isActive: patch.isActive ?? existing.isActive,
        isSearchable: patch.isSearchable ?? existing.isSearchable,
        updatedAtMs: now(),
      });
      store.objects.set(name, next);
      return json(200, { ...next, ...localDevMetadataSourceBanner() });
    }
  }

  // Facets
  if (segments.length === 1 && segments[0] === 'facets' && verb === 'GET') {
    return json(200, {
      facets: [...store.facets.values()],
      ...localDevMetadataSourceBanner(),
    });
  }
  if (segments.length === 1 && segments[0] === 'facets' && verb === 'POST') {
    const facet = body as FacetDefWire;
    if (!facet?.name) return badRequest('facet_name_required', 'name is required');
    if (facet.isSystem) {
      return json(403, { error: 'facet_system_immutable', message: facet.name });
    }
    if (store.facets.has(facet.name)) {
      return json(409, { error: 'commonplace_metadata_exists', message: facet.name });
    }
    store.facets.set(facet.name, facet);
    return json(201, { ...facet, ...localDevMetadataSourceBanner() });
  }
  if (segments.length === 2 && segments[0] === 'facets') {
    const name = segments[1]!;
    const facet = store.facets.get(name);
    if (verb === 'GET') {
      if (!facet) return notFound('facet_missing', name);
      return json(200, { ...facet, ...localDevMetadataSourceBanner() });
    }
    if (verb === 'DELETE') {
      if (!facet) return notFound('facet_missing', name);
      if (facet.isSystem) {
        return json(403, { error: 'facet_system_immutable', message: name });
      }
      store.facets.delete(name);
      return new Response(null, { status: 204 });
    }
  }

  // Conformances
  if (segments.length === 3 && segments[0] === 'objects' && segments[2] === 'conformances') {
    const objectName = segments[1]!;
    const object = store.objects.get(objectName);
    if (!object) return notFound('commonplace_metadata_missing', objectName);
    if (verb === 'GET') {
      return json(200, {
        conformances: object.conformances ?? [],
        ...localDevMetadataSourceBanner(),
      });
    }
    if (verb === 'POST') {
      const incoming = body as Partial<ObjectConformanceWire>;
      const facet = String(incoming.facet ?? '').trim();
      if (!facet) return badRequest('facet_required', 'facet is required');
      if (!store.facets.has(facet)) return notFound('facet_missing', facet);
      const conformance: ObjectConformanceWire = {
        objectNameSingular: objectName,
        facet,
        propertyMap: incoming.propertyMap ?? {},
        relationMap: incoming.relationMap ?? {},
        createdAtMs: now(),
      };
      const nextConformances = [
        ...(object.conformances ?? []).filter((row) => row.facet !== facet),
        conformance,
      ];
      store.objects.set(objectName, { ...object, conformances: nextConformances, updatedAtMs: now() });
      return json(201, { ...conformance, ...localDevMetadataSourceBanner() });
    }
  }
  if (
    segments.length === 4 &&
    segments[0] === 'objects' &&
    segments[2] === 'conformances' &&
    verb === 'DELETE'
  ) {
    const objectName = segments[1]!;
    const facet = segments[3]!;
    const object = store.objects.get(objectName);
    if (!object) return notFound('commonplace_metadata_missing', objectName);
    store.objects.set(objectName, {
      ...object,
      conformances: (object.conformances ?? []).filter((row) => row.facet !== facet),
      updatedAtMs: now(),
    });
    return new Response(null, { status: 204 });
  }

  // Fields
  if (segments.length === 1 && segments[0] === 'fields' && verb === 'POST') {
    const incoming = body as Partial<FieldMetadataWire> & { objectNameSingular?: string };
    const objectName = String(incoming.objectNameSingular ?? '').trim();
    const object = store.objects.get(objectName);
    if (!object) return notFound('commonplace_metadata_missing', objectName);
    const name = String(incoming.name ?? '').trim();
    if (!name) return badRequest('field_name_required', 'name is required');
    const created = field(objectName, name, String(incoming.label ?? name), incoming.type ?? 'TEXT', {
      description: incoming.description,
      isNullable: incoming.isNullable,
      settings: incoming.settings ?? { isFilterable: false, isSortable: false },
    });
    const fields = [...object.fields.filter((row) => row.name !== name), created];
    store.objects.set(objectName, withFieldsList({ ...object, fields, updatedAtMs: now() }));
    return json(201, { ...withFieldsList(store.objects.get(objectName)!), ...localDevMetadataSourceBanner() });
  }
  if (segments.length === 3 && segments[0] === 'fields') {
    const objectName = segments[1]!;
    const fieldName = segments[2]!;
    const object = store.objects.get(objectName);
    if (!object) return notFound('commonplace_metadata_missing', objectName);
    const existing = object.fields.find((row) => row.name === fieldName);
    if (!existing) return notFound('commonplace_metadata_missing', `${objectName}.${fieldName}`);
    if (verb === 'DELETE') {
      const fields = object.fields.filter((row) => row.name !== fieldName);
      store.objects.set(objectName, withFieldsList({ ...object, fields, updatedAtMs: now() }));
      return json(200, { ...withFieldsList(store.objects.get(objectName)!), ...localDevMetadataSourceBanner() });
    }
    if (verb === 'PATCH') {
      if (existing.isSystem) {
        return json(403, {
          error: 'commonplace_metadata_system_type',
          message: `${objectName}.${fieldName}`,
        });
      }
      const patch = (body ?? {}) as Partial<FieldMetadataWire>;
      const nextField: FieldMetadataWire = {
        ...existing,
        label: patch.label ?? existing.label,
        description: patch.description ?? existing.description,
        type: patch.type ?? existing.type,
        isNullable: patch.isNullable ?? existing.isNullable,
        isUnique: patch.isUnique ?? existing.isUnique,
        settings: {
          isFilterable: patch.settings?.isFilterable ?? existing.settings.isFilterable,
          isSortable: patch.settings?.isSortable ?? existing.settings.isSortable,
          displayAs: patch.settings?.displayAs ?? existing.settings.displayAs,
          raw: patch.settings?.raw ?? existing.settings.raw,
        },
        updatedAtMs: now(),
      };
      const fields = object.fields.map((row) => (row.name === fieldName ? nextField : row));
      store.objects.set(objectName, withFieldsList({ ...object, fields, updatedAtMs: now() }));
      return json(200, { ...withFieldsList(store.objects.get(objectName)!), ...localDevMetadataSourceBanner() });
    }
  }

  // Indexes / promote
  if (segments.length === 3 && segments[0] === 'indexes') {
    const objectName = segments[1]!;
    const fieldName = segments[2]!;
    const object = store.objects.get(objectName);
    if (!object) return notFound('commonplace_metadata_missing', objectName);
    const target = object.fields.find((row) => row.name === fieldName);
    if (!target) return notFound('commonplace_metadata_missing', `${objectName}.${fieldName}`);
    if (verb === 'POST') {
      const index: IndexMetadataWire = {
        id: `index:${objectName}:${fieldName}`,
        name: `${objectName}_${fieldName}_idx`,
        indexType: 'BTREE',
        isUnique: false,
        isCustom: true,
        trigger: { kind: 'user_marked' },
        indexFieldMetadataList: [{ fieldMetadataId: target.id, order: 0 }],
        createdAtMs: now(),
      };
      const indexes = [
        ...object.indexMetadataList.filter((row) => row.id !== index.id),
        index,
      ];
      const fields = object.fields.map((row) =>
        row.name === fieldName
          ? {
              ...row,
              settings: { ...row.settings, isFilterable: true, isSortable: true },
              updatedAtMs: now(),
            }
          : row,
      );
      store.objects.set(
        objectName,
        withFieldsList({ ...object, fields, indexMetadataList: indexes, updatedAtMs: now() }),
      );
      return json(201, { ...index, ...localDevMetadataSourceBanner() });
    }
    if (verb === 'DELETE') {
      const indexes = object.indexMetadataList.filter(
        (row) => !row.indexFieldMetadataList.some((entry) => entry.fieldMetadataId === target.id),
      );
      store.objects.set(objectName, {
        ...object,
        indexMetadataList: indexes,
        updatedAtMs: now(),
      });
      return new Response(null, { status: 204 });
    }
  }

  if (segments.length === 1 && segments[0] === 'promotion-candidates' && verb === 'GET') {
    const candidates: PromotionCandidateWire[] = [];
    for (const object of store.objects.values()) {
      for (const fieldRow of object.fields) {
        const promoted = object.indexMetadataList.some((index) =>
          index.indexFieldMetadataList.some((entry) => entry.fieldMetadataId === fieldRow.id),
        );
        if (!promoted && !fieldRow.isSystem) {
          candidates.push({
            objectNameSingular: object.nameSingular,
            fieldName: fieldRow.name,
            trigger: { kind: 'user_marked' },
          });
        }
      }
    }
    return json(200, { candidates, ...localDevMetadataSourceBanner() });
  }

  return notFound('metadata_route_missing', `/${segments.join('/')}`);
}
