import {
  planToProgrammableGraph,
  sideEffectingAffordanceRefs,
} from '@commonplace/theorem-acp/plan-program';
import {
  applyParamBindings,
  extractParamCandidates,
  type ParamCandidate,
} from '@commonplace/theorem-acp/plan-params';
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
  const runsRail = await callHarnessMcp('plan', { action: 'query', plan_id: planId, query: 'progress' });

  return Response.json({
    schema: 'commonplace.plan-canvas-poll/1',
    snapshot: snapshot.data,
    events: events.ok ? events.data : { rows: [] },
    capabilities: manifest?.ok ? manifest.data : { capabilities: [] },
    runsRail: runsRail.ok ? normalizeRunsFromProgress(runsRail.data, planId, snapshot.data) : [],
    // The polling cursor is an event-log cursor. A fresh inspect snapshot may
    // be newer while what_changed is degraded, but advancing to that version
    // would permanently skip the unavailable event interval.
    cursor: events.ok ? Math.max(cursor, graphVersion(events.data)) : cursor,
    degraded: {
      events: !events.ok,
      capabilities: includeManifest && !manifest?.ok,
      runsRail: !runsRail.ok,
    },
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
  if (action === 'save_as_program') return saveAsProgram(planId, body);

  const taskId = validText(body.taskId ?? body.task_id);
  let input: Record<string, unknown>;
  switch (action) {
    case 'queue_affordance': {
      const ref = validText(body.affordanceRef ?? body.affordance_ref);
      if (!taskId || !ref) return Response.json({ error: 'task_and_affordance_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{
          task_id: taskId,
          queue_affordance: {
            ref,
            config: body.config ?? {},
            grant_state: validText(body.grantState ?? body.grant_state) ?? 'granted',
            missing_capability: validText(body.missingCapability ?? body.missing_capability),
          },
        }],
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
    case 'revert_mutation':
      if (!taskId) return Response.json({ error: 'task_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, revert_mutation: true }],
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
    case 'add_task': {
      const title = validText(body.title);
      const parentId = validText(body.parentId ?? body.parent_id);
      if (!title) return Response.json({ error: 'title_required' }, { status: 400 });
      input = {
        action: 'add_task',
        plan_id: planId,
        alias: slugAlias(title),
        title,
        goal: title,
        dependencies: parentId ? [parentId] : [],
        provenance: 'human:console',
        branch: body.branch === true,
      };
      break;
    }
    case 'complete_task':
      if (!taskId) return Response.json({ error: 'task_required' }, { status: 400 });
      input = {
        action: 'done',
        plan_id: planId,
        task_id: taskId,
        reason: validText(body.receipt) ?? 'Completed from the Goal Stack',
      };
      break;
    case 'skip_task': {
      const reason = validText(body.reason);
      if (!taskId || !reason) return Response.json({ error: 'task_and_reason_required' }, { status: 400 });
      input = {
        action: 'failed',
        plan_id: planId,
        task_id: taskId,
        reason,
      };
      break;
    }
    case 'pin_position': {
      const x = number(body.x);
      const y = number(body.y);
      if (!taskId || x === null || y === null) {
        return Response.json({ error: 'task_and_position_required' }, { status: 400 });
      }
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{ task_id: taskId, pin_position: { x, y } }],
      };
      break;
    }
    case 'consent_proposal':
    case 'deny_proposal': {
      const proposalId = validText(body.proposalId ?? body.proposal_id);
      if (!proposalId) return Response.json({ error: 'proposal_required' }, { status: 400 });
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{
          proposal_id: proposalId,
          proposal_decision: action === 'consent_proposal' ? 'consent' : 'deny',
        }],
      };
      break;
    }
    case 'report_progress': {
      const fraction = number(body.fraction);
      if (!taskId || fraction === null) {
        return Response.json({ error: 'task_and_fraction_required' }, { status: 400 });
      }
      if (fraction < 0 || fraction > 1) {
        return Response.json({
          error: 'plan_action_refused',
          rule: 'progress_fraction_out_of_range',
          detail: 'Progress fraction must be within 0..=1.',
        }, { status: 409 });
      }
      input = {
        action: 'update',
        plan_id: planId,
        changes: [{
          task_id: taskId,
          progress: { fraction, note: validText(body.note) },
        }],
      };
      break;
    }
    default:
      return Response.json({ error: 'unsupported_plan_action' }, { status: 400 });
  }

  const result = await callHarnessMcp('plan', input);
  if (!result.ok) return result.response;
  return refusalResponse(result.data) ?? Response.json({ ok: true, result: result.data });
}

async function saveAsProgram(planId: string, body: Record<string, unknown>): Promise<Response> {
  const inspected = await callHarnessMcp('plan', { action: 'inspect', plan_id: planId });
  if (!inspected.ok) return inspected.response;
  const snapshot = normalizePlanSnapshot(inspected.data);
  if (!snapshot) return Response.json({ error: 'plan_projection_invalid' }, { status: 502 });
  if (!planIsComplete(snapshot)) {
    return Response.json({ error: 'plan_not_complete' }, { status: 409 });
  }
  const sideEffectingRefs = sideEffectingAffordanceRefs(snapshot);
  // Re-extract candidates server-side so reviewed bindings rewrite titles /
  // descriptions before materialize; client candidates are advisory only.
  const candidates = extractParamCandidates(snapshot);
  const bindings = stringBindings(body.bindings);
  const bound = applyParamBindings(snapshot, candidates, bindings);
  const graph = planToProgrammableGraph(bound);
  const program = {
    ...graph,
    tenant_id: inspected.principal.tenant,
    metadata: {
      ...graph.metadata,
      param_bindings: bindings,
      param_candidates: candidates.map(serializeCandidate),
      source_side_effecting_affordance_refs: sideEffectingRefs,
    },
  };
  const result = await callHarnessMcp('programmable_graph_apply', {
    action: 'materialize',
    program,
  });
  if (!result.ok) return result.response;
  return refusalResponse(result.data) ?? Response.json({ ok: true, result: result.data });
}

function serializeCandidate(candidate: ParamCandidate): Record<string, string> {
  return {
    id: candidate.id,
    kind: candidate.kind,
    taskId: candidate.taskId,
    field: candidate.field,
    value: candidate.value,
    label: candidate.label,
  };
}

function stringBindings(value: unknown): Record<string, string> {
  const item = record(value);
  if (!item) return {};
  return Object.fromEntries(Object.entries(item).filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string'));
}

function normalizeRunsFromProgress(
  progressPayload: Record<string, unknown>,
  planId: string,
  snapshotData: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const snapshot = normalizePlanSnapshot(snapshotData);
  if (!snapshot) return [];
  const done = snapshot.progress.done;
  const total = snapshot.progress.total;
  const head = snapshot.tasks.find((task) => task.status === 'running')?.claimHolder
    ?? snapshot.tasks.find((task) => task.claimHolder)?.claimHolder
    ?? null;
  return [{
    run_id: snapshot.runId ?? planId,
    plan_id: planId,
    name: snapshot.title,
    done,
    total,
    completion_fraction: total > 0 ? done / total : 0,
    head_presence: head,
    last_event_at: snapshot.events.at(-1)?.at ?? null,
    progress: progressPayload,
  }];
}

function refusalResponse(data: Record<string, unknown>): Response | null {
  const refusal = record(data.refusal);
  const refused = data.refused === true || data.status === 'refused' || data.ok === false || refusal !== null;
  if (!refused) return null;
  return Response.json({
    error: 'plan_action_refused',
    rule: validText(refusal?.code) ?? validText(data.rule) ?? validText(data.code) ?? 'unspecified',
    detail: validText(refusal?.detail) ?? validText(data.detail) ?? validText(data.reason) ?? 'The Plan substrate refused this transition.',
    receiptId: validText(refusal?.receipt_id ?? refusal?.receiptId ?? data.receipt_id ?? data.receiptId),
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

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function slugAlias(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return slug || `task-${Date.now()}`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
