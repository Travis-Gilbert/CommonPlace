import 'server-only';

import { callHarnessMcp, type HarnessMcpResult } from '@/lib/server/harness-mcp';

type JsonObject = Record<string, unknown>;
type HarnessCall = (
  name: string,
  argumentsValue: JsonObject,
) => Promise<HarnessMcpResult>;

export interface RecordPageQuery {
  readonly viewId?: string;
  readonly offset?: number;
  readonly limit?: number;
}

export type RecordAction =
  | { readonly action: 'focus'; readonly recordId: string }
  | {
      readonly action: 'edit';
      readonly recordId: string;
      readonly fieldKey: string;
      readonly value: unknown;
    }
  | { readonly action: 'switch_view'; readonly viewId: string }
  | { readonly action: 'save_view'; readonly view: JsonObject }
  | {
      readonly action: 'aggregate';
      readonly fieldKey: string;
      readonly operation: string;
    };

export type RecordPageResult =
  | { readonly ok: true; readonly page: JsonObject }
  | { readonly ok: false; readonly response: Response };

interface RecordContext {
  readonly objectType: JsonObject;
  readonly view: JsonObject;
  readonly views: unknown[];
  readonly stream: string;
}

export async function loadTheoremwebRecordPage(
  surfaceId: string,
  query: RecordPageQuery = {},
  call: HarnessCall = callHarnessMcp,
): Promise<RecordPageResult> {
  const resolved = await resolveRecordContext(surfaceId, query.viewId, call);
  if (!resolved.ok) return resolved;

  const { objectType, view, views, stream } = resolved.context;
  const namePlural = requiredString(objectType, 'name_plural');
  if (!namePlural) return contractFailure('record_object_type_invalid');

  const filters = arrayValue(view.filters);
  const sorts = arrayValue(view.sorts);
  const findArguments: JsonObject = {
    filters,
    sorts,
    offset: boundedInteger(query.offset, 0, 10_000, 0),
    limit: boundedInteger(query.limit, 1, 500, 100),
  };
  const groupBy = optionalString(view, 'group_by');
  if (groupBy) findArguments.group_by = groupBy;

  const pageResult = await call('invoke', {
    name: `find_many_${snakeCase(namePlural)}`,
    arguments: findArguments,
  });
  if (!pageResult.ok) return pageResult;
  const streamResult = await call('stream_read', { stream });
  if (!streamResult.ok) return streamResult;

  const records = arrayValue(pageResult.data.records);
  return {
    ok: true,
    page: {
      object_type: objectType,
      view,
      views,
      rows: records.flatMap((candidate) => {
        const record = objectValue(candidate);
        const recordId = record && requiredString(record, 'id');
        const values = record && objectValue(record.properties);
        return recordId && values ? [{ record_id: recordId, values }] : [];
      }),
      total: nonNegativeInteger(pageResult.data.count),
      presence_events: arrayValue(streamResult.data.events),
      stream,
    },
  };
}

export async function applyTheoremwebRecordAction(
  surfaceId: string,
  action: RecordAction,
  query: RecordPageQuery = {},
  call: HarnessCall = callHarnessMcp,
): Promise<RecordPageResult> {
  let pageViewId = action.action === 'switch_view' ? action.viewId : query.viewId;
  const resolved = await resolveRecordContext(surfaceId, pageViewId, call);
  if (!resolved.ok) return resolved;
  const { objectType, view, stream } = resolved.context;
  const objectTypeId = requiredString(objectType, 'object_type_id');
  const nameSingular = requiredString(objectType, 'name_singular');
  const namePlural = requiredString(objectType, 'name_plural');
  const viewId = requiredString(view, 'view_id');
  if (!objectTypeId || !nameSingular || !namePlural || !viewId) {
    return contractFailure('record_context_invalid');
  }

  let aggregate: JsonObject | undefined;
  if (action.action === 'edit') {
    const fieldKeys = arrayValue(objectType.fields)
      .map(objectValue)
      .flatMap((field) => field ? [requiredString(field, 'key')] : [])
      .filter((field): field is string => Boolean(field));
    if (!fieldKeys.includes(action.fieldKey)) {
      return contractFailure('record_field_unknown', 400);
    }
    const updated = await call('invoke', {
      name: `update_one_${snakeCase(nameSingular)}`,
      arguments: { id: action.recordId, [action.fieldKey]: action.value },
    });
    if (!updated.ok) return updated;
    const published = await publishPresence(
      call,
      stream,
      'view.write',
      viewId,
      objectTypeId,
      action.recordId,
    );
    if (!published.ok) return published;
  } else if (action.action === 'focus') {
    const published = await publishPresence(
      call,
      stream,
      'view.focus',
      viewId,
      objectTypeId,
      action.recordId,
    );
    if (!published.ok) return published;
  } else if (action.action === 'save_view') {
    const requested: JsonObject = { ...action.view, object_type_id: objectTypeId };
    delete requested.tenant_id;
    const saved = await call('view_upsert', { view: requested });
    if (!saved.ok) return saved;
    const savedView = objectValue(saved.data.view);
    if (!savedView) return contractFailure('record_view_save_invalid');
    pageViewId = requiredString(savedView, 'view_id') ?? viewId;
  } else if (action.action === 'aggregate') {
    const aggregated = await call('invoke', {
      name: `aggregate_${snakeCase(namePlural)}`,
      arguments: {
        filters: arrayValue(view.filters),
        sorts: arrayValue(view.sorts),
        field: action.fieldKey,
        op: action.operation,
      },
    });
    if (!aggregated.ok) return aggregated;
    aggregate = aggregated.data;
  }

  const page = await loadTheoremwebRecordPage(
    surfaceId,
    { ...query, viewId: pageViewId },
    call,
  );
  if (!page.ok || !aggregate) return page;
  return { ok: true, page: { ...page.page, aggregate } };
}

async function resolveRecordContext(
  surfaceId: string,
  requestedViewId: string | undefined,
  call: HarnessCall,
): Promise<
  | { readonly ok: true; readonly context: RecordContext }
  | { readonly ok: false; readonly response: Response }
> {
  const surfaceResult = await call('surface_get', { surface_id: surfaceId });
  if (!surfaceResult.ok) return surfaceResult;
  const surface = objectValue(surfaceResult.data.surface);
  if (!surface) return contractFailure('record_surface_not_found', 404);
  const layoutRef = requiredString(surface, 'layout_ref');
  if (!layoutRef) return contractFailure('record_surface_layout_missing', 404);

  const layoutResult = await call('layout_get', { layout_id: layoutRef });
  if (!layoutResult.ok) return layoutResult;
  const layout = objectValue(layoutResult.data.layout);
  if (!layout) return contractFailure('record_layout_not_found', 404);
  const widget = arrayValue(layout.tabs)
    .map(objectValue)
    .flatMap((tab) => arrayValue(tab?.widgets))
    .map(objectValue)
    .find((candidate) => requiredString(candidate, 'body_kind') === 'record_table');
  const bodyParams = widget && objectValue(widget.body_params);
  const nameSingular = bodyParams && requiredString(bodyParams, 'name_singular');
  const configuredViewId = bodyParams && requiredString(bodyParams, 'view_id');
  if (!nameSingular || !configuredViewId) {
    return contractFailure('record_layout_contract_missing', 404);
  }

  const schemaResult = await call('schema_get', { name_singular: nameSingular });
  if (!schemaResult.ok) return schemaResult;
  const objectType = objectValue(schemaResult.data);
  const objectTypeId = objectType && requiredString(objectType, 'object_type_id');
  if (!objectType || !objectTypeId) return contractFailure('record_object_type_invalid');

  const viewId = requestedViewId ?? configuredViewId;
  const [viewResult, viewsResult] = await Promise.all([
    call('view_get', { view_id: viewId }),
    call('view_list', { object_type_id: objectTypeId }),
  ]);
  if (!viewResult.ok) return viewResult;
  if (!viewsResult.ok) return viewsResult;
  const view = objectValue(viewResult.data.view);
  if (!view || requiredString(view, 'object_type_id') !== objectTypeId) {
    return contractFailure('record_view_object_type_mismatch', 400);
  }
  return {
    ok: true,
    context: {
      objectType,
      view,
      views: arrayValue(viewsResult.data.views),
      stream: `view:${viewId}`,
    },
  };
}

async function publishPresence(
  call: HarnessCall,
  stream: string,
  kind: 'view.focus' | 'view.write',
  viewId: string,
  objectTypeId: string,
  recordId: string,
): Promise<HarnessMcpResult> {
  return call('stream_publish', {
    stream,
    kind,
    payload: {
      viewId,
      objectTypeId,
      recordId,
      actorKind: 'human',
      displayName: 'You',
    },
  });
}

function contractFailure(error: string, status = 502): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error }, { status }) };
}

function objectValue(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requiredString(value: JsonObject | null | undefined, key: string): string | null {
  const candidate = value?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function optionalString(value: JsonObject, key: string): string | null {
  return requiredString(value, key);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function boundedInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return Number.isInteger(value) && value !== undefined
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}
