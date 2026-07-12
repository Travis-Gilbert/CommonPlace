import { NextResponse } from 'next/server';
import {
  buildOperatorState,
  handleOperatorAction,
  type OperatorActionResult,
} from '@/lib/theorem-operator';
import { buildOperatorStateLive } from '@/lib/theorem-operator-live';

// The Operator surface renders substrate state only (Invariant 1). Force-dynamic
// so fixtures (and, once wired, live reads) run per request on the server; the
// client receives JSON via useApiData with no hydration drift.
export const dynamic = 'force-dynamic';

export async function GET() {
  // PT-010: try the live harness workGraph read (run-scoped, env-selected);
  // any missing config / empty read / error returns null → fixtures. Fail-open.
  try {
    const live = await buildOperatorStateLive(process.env, new Date(), globalThis.fetch);
    if (live) return NextResponse.json(live);
  } catch {
    // fall through to fixtures
  }
  return NextResponse.json(buildOperatorState(process.env, new Date(), globalThis.fetch));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, action: 'unknown', error: 'invalid_action', message: 'Expected JSON body.' },
      { status: 400 },
    );
  }

<<<<<<< HEAD
  const now = new Date();
  let state = buildOperatorState(process.env, now, globalThis.fetch);
  try {
    state = (await buildOperatorStateLive(process.env, now, globalThis.fetch)) ?? state;
  } catch {
    // keep fixture state
  }

  const result = handleOperatorActionForState(body, state);
=======
  const result = handleOperatorAction(body, process.env, new Date(), globalThis.fetch);
>>>>>>> origin/main
  return NextResponse.json(result, { status: statusForOperatorResult(result) });
}

function statusForOperatorResult(result: OperatorActionResult): number {
  if (result.ok) return 200;

  switch (result.error) {
    case 'invalid_action':
    case 'missing_required_changes':
    case 'empty_message':
      return 400;
    case 'task_not_found':
    case 'bay_not_found':
    case 'not_in_review':
      return 404;
    case 'bay_occupied':
    case 'prerequisite_unmet':
    case 'evidence_missing':
    default:
      return 409;
  }
}
