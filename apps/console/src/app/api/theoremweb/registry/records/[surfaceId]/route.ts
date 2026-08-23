import {
  applyTheoremwebRecordAction,
  loadTheoremwebRecordPage,
  type RecordAction,
} from '@/lib/server/theoremweb-records';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ surfaceId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { surfaceId } = await context.params;
  const url = new URL(request.url);
  const result = await loadTheoremwebRecordPage(surfaceId, {
    viewId: optionalText(url.searchParams.get('view_id')),
    offset: optionalInteger(url.searchParams.get('offset')),
    limit: optionalInteger(url.searchParams.get('limit')),
  });
  return result.ok ? Response.json(result.page) : result.response;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const [{ surfaceId }, payload] = await Promise.all([
    context.params,
    request.json().catch(() => null),
  ]);
  const action = parseAction(payload);
  if (!action) {
    return Response.json({ error: 'record_action_invalid' }, { status: 400 });
  }
  const result = await applyTheoremwebRecordAction(surfaceId, action);
  return result.ok ? Response.json(result.page) : result.response;
}

function parseAction(value: unknown): RecordAction | null {
  const body = objectValue(value);
  const action = body && text(body.action);
  if (!body || !action) return null;
  if (action === 'focus') {
    const recordId = text(body.record_id);
    return recordId ? { action, recordId } : null;
  }
  if (action === 'edit') {
    const recordId = text(body.record_id);
    const fieldKey = text(body.field_key);
    return recordId && fieldKey && Object.hasOwn(body, 'value')
      ? { action, recordId, fieldKey, value: body.value }
      : null;
  }
  if (action === 'switch_view') {
    const viewId = text(body.view_id);
    return viewId ? { action, viewId } : null;
  }
  if (action === 'save_view') {
    const view = objectValue(body.view);
    return view ? { action, view } : null;
  }
  if (action === 'aggregate') {
    const fieldKey = text(body.field_key);
    const operation = text(body.operation);
    return fieldKey && operation ? { action, fieldKey, operation } : null;
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalText(value: string | null): string | undefined {
  return value?.trim() || undefined;
}

function optionalInteger(value: string | null): number | undefined {
  if (value === null || !/^-?\d+$/.test(value)) return undefined;
  return Number.parseInt(value, 10);
}
