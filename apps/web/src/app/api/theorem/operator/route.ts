import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  type OperatorActionResult,
} from '@/lib/theorem-operator';
import { handleOperatorActionLive, loadOperatorStateLive } from '@/lib/theorem-operator-live';

export const dynamic = 'force-dynamic';

type OwnerSession = {
  user?: {
    isOwner?: unknown;
  };
};

export async function GET(req: Request) {
  const caller = await authorizedOperatorCaller(req);
  if (!caller) return unauthorized();

  const requestId = req.headers.get('x-request-id')?.trim() || randomUUID();
  const live = await loadOperatorStateLive(process.env, new Date(), globalThis.fetch, requestId);
  if (!live.ok) return unavailable(live, requestId);
  return NextResponse.json(live.state, { headers: { 'x-request-id': requestId } });
}

export async function POST(req: Request) {
  const caller = await authorizedOperatorCaller(req);
  if (!caller) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, action: 'unknown', error: 'invalid_action', message: 'Expected JSON body.' },
      { status: 400 },
    );
  }

  const requestId = req.headers.get('x-request-id')?.trim() || randomUUID();
  const now = new Date();
  const live = await loadOperatorStateLive(process.env, now, globalThis.fetch, requestId);
  if (!live.ok) return unavailable(live, requestId);

  const result = await handleOperatorActionLive(
    body,
    live.state,
    live.contract,
    caller.actor,
    process.env,
    now,
    globalThis.fetch,
  );
  return NextResponse.json(result, {
    status: statusForOperatorResult(result),
    headers: { 'x-request-id': requestId },
  });
}

interface OperatorCaller {
  actor: string;
}

async function authorizedOperatorCaller(req: Request): Promise<OperatorCaller | null> {
  let session: OwnerSession | null = null;
  try {
    session = (await auth()) as OwnerSession | null;
  } catch {
    // A dedicated route token remains a valid recovery path when session auth
    // is unavailable; without that token the request is still refused below.
  }
  if (session?.user?.isOwner === true) return { actor: 'commonplace:github:Travis-Gilbert' };

  const actual = bearerToken(req);
  if (!actual) return null;

  const operatorToken = text(process.env.THEOREM_OPERATOR_API_TOKEN);
  if (operatorToken && safeTokenEquals(actual, operatorToken)) {
    const actor = credentialActor('operator', process.env.THEOREM_OPERATOR_CREDENTIAL_ID);
    return actor ? { actor } : null;
  }
  const controlCenterToken = text(process.env.THEOREM_CONTROL_CENTER_API_TOKEN);
  if (controlCenterToken && safeTokenEquals(actual, controlCenterToken)) {
    const actor = credentialActor('control-center', process.env.THEOREM_CONTROL_CENTER_CREDENTIAL_ID);
    return actor ? { actor } : null;
  }
  return null;
}

function credentialActor(
  kind: 'operator' | 'control-center',
  configuredId: string | undefined,
): OperatorCaller['actor'] | null {
  const credentialId = text(configuredId);
  if (!credentialId || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(credentialId)) return null;
  return `commonplace:credential:${kind}:${credentialId}`;
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'unauthorized', message: 'Owner session or operator API token required.' },
    { status: 401 },
  );
}

function unavailable(
  live: Extract<Awaited<ReturnType<typeof loadOperatorStateLive>>, { ok: false }>,
  requestId: string,
) {
  return NextResponse.json(
    {
      ok: false,
      error: live.error,
      message: live.message,
      tenant: live.tenant,
      requestId,
    },
    { status: 503, headers: { 'x-request-id': requestId } },
  );
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('authorization') ?? '';
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === 'bearer' ? text(token) : null;
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
    case 'mutation_not_implemented':
      return 501;
    case 'mutation_failed':
    case 'tenant_mismatch':
      return 502;
    case 'bay_occupied':
    case 'prerequisite_unmet':
    case 'evidence_missing':
    default:
      return 409;
  }
}
