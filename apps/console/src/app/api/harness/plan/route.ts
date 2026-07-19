import { planToProgrammableGraph } from '@commonplace/theorem-acp/plan-program';
import {
  normalizePlanSnapshot,
  planIsComplete,
} from '@commonplace/theorem-acp/plan-state';
import { callHarnessMcp } from '@/lib/server/harness-mcp';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const planId = validText(url.searchParams.get('id'));
  if (!planId) return Response.json({ error: 'plan_id_required' }, { status: 400 });
  const cursor = validCursor(url.searchParams.get('cursor'));
  const includeManifest = url.searchParams.get('manifest') !== '0';

  const snapshot = await callHarnessMcp('plan', { action: 'inspect', plan_id: planId });
  if (!snapshot.ok) return snapshot.response;
  const events = await callHarnessMcp('plan', {
    action: 'what_changed',
    plan_id: planId,
    anchor: `graph:${cursor}`,
  });
  const manifest = includeManifest
    ? await callHarnessMcp('plan', { action: 'capability_manifest', plan_id: planId })
    : null;

  return Response.json({
    schema: 'commonplace.plan-canvas-poll/1',
    snapshot: snapshot.data,
    events: events.ok ? events.data : { rows: [] },
    capabilities: manifest?.ok ? manifest.data : { capabilities: [] },
    cursor: Math.max(cursor, graphVersion(events.ok ? events.data : null)),
    degraded: { events: !events.ok, capabilities: includeManifest && !manifest?.ok },
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = record(await request.json().catch(() => null));
  if (!body) return Response.json({ error: 'json_object_required' }, { status: 400 });
  const planId = validText(body.planId ?? body.plan_id);
  const action = validText(body.action);
  if (!planId || !action) {
    return Response.json({ error: 'plan_id_and_action_required' }, { status: 400 });
  }
  if (action === 'save_as_program') return saveAsProgram(planId);

  const taskId = validText(body.taskId ?? body.task_id);
  let input: Record<string, unknown>;
  switch (action) {
    case 'queue_affordance': {
      const ref = validText(body.affordanceRef ?? body.affordance_ref);
      if (!taskId || !ref) return Response.json({ error: 'task_and_affordance_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, queue_affordance: { ref, config: body.config ?? {} } }],
      };
      break;
    }
    case 'remove_affordance': {
      const ref = validText(body.affordanceRef ?? body.affordance_ref);
      if (!taskId || !ref) return Response.json({ error: 'task_and_affordance_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, remove_affordance: ref }],
      };
      break;
    }
    case 'approval_decision': {
      const decision = validText(body.decision);
      if (!taskId || (decision !== 'allow' && decision !== 'reject')) {
        return Response.json({ error: 'task_and_approval_decision_required' }, { status: 400 });
      }
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, approval_decision: decision }],
      };
      break;
    }
    case 'revert_task':
      if (!taskId) return Response.json({ error: 'task_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, revert_task_file_changes: true }],
      };
      break;
    case 'replan_subtree':
      if (!taskId) return Response.json({ error: 'task_required' }, { status: 400 });
      input = {
        action: 'replan_subtree',
        plan_id: planId,
        task_id: taskId,
        reason: validText(body.reason) ?? 'Requested from the CommonPlace Goal Stack',
      };
      break;
    default:
      return Response.json({ error: 'unsupported_plan_action' }, { status: 400 });
  }

  const result = await callHarnessMcp('plan', input);
  if (!result.ok) return result.response;
  return refusalResponse(result.data) ?? Response.json({ ok: true, result: result.data });
}

async function saveAsProgram(planId: string): Promise<Response> {
  const inspected = await callHarnessMcp('plan', { action: 'inspect', plan_id: planId });
  if (!inspected.ok) return inspected.response;
  const snapshot = normalizePlanSnapshot(inspected.data);
  if (!snapshot) return Response.json({ error: 'plan_projection_invalid' }, { status: 502 });
  if (!planIsComplete(snapshot)) {
    return Response.json({ error: 'plan_not_complete' }, { status: 409 });
  }
  const program = {
    ...planToProgrammableGraph(snapshot),
    tenant_id: inspected.principal.tenant,
  };
  const result = await callHarnessMcp('programmable_graph_apply', {
    action: 'materialize',
    program,
  });
  if (!result.ok) return result.response;
  return refusalResponse(result.data) ?? Response.json({ ok: true, result: result.data });
}

function refusalResponse(data: Record<string, unknown>): Response | null {
  const refused = data.refused === true || data.status === 'refused';
  if (!refused) return null;
  return Response.json({
    error: 'plan_action_refused',
    rule: validText(data.rule) ?? validText(data.code) ?? 'unspecified',
    detail: validText(data.detail) ?? validText(data.reason) ?? 'The Plan substrate refused this transition.',
    receiptId: validText(data.receipt_id ?? data.receiptId),
  }, { status: 409 });
}

function graphVersion(value: unknown): number {
  const root = record(value);
  const rows = Array.isArray(root?.rows) ? root.rows : [];
  return rows.reduce((maximum, row) => {
    const item = record(row);
    const candidate = item?.graph_version ?? item?.graphVersion;
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(maximum, candidate)
      : maximum;
  }, 0);
}

function validCursor(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function validText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= 512
    ? value.trim()
    : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
