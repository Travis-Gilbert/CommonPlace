import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  buildTheoremControlCenterStateLive,
  handleTheoremControlCenterAction,
} from '@/lib/theorem-control-center';

export const dynamic = 'force-dynamic';

type OwnerSession = {
  user?: {
    isOwner?: unknown;
  };
};

function configuredControlCenterToken(env: NodeJS.ProcessEnv): string | null {
  return (
    text(env.THEOREM_CONTROL_CENTER_API_TOKEN) ??
    text(env.COMMONPLACE_CONTROL_CENTER_TOKEN)
  );
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get('authorization') ?? '';
  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === 'bearer' ? text(token) : null;
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

async function isAuthorizedControlCenterRequest(req: Request): Promise<boolean> {
  const session = (await auth()) as OwnerSession | null;
  if (session?.user?.isOwner === true) return true;

  const expected = configuredControlCenterToken(process.env);
  const actual = bearerToken(req);
  return Boolean(expected && actual && safeTokenEquals(actual, expected));
}

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      error: 'unauthorized',
      message: 'Owner session or control-center API token required.',
    },
    { status: 401 },
  );
}

export async function GET(req: Request) {
  if (!(await isAuthorizedControlCenterRequest(req))) return unauthorized();
  return NextResponse.json(
    await buildTheoremControlCenterStateLive(process.env, new Date(), globalThis.fetch),
  );
}

export async function POST(req: Request) {
  if (!(await isAuthorizedControlCenterRequest(req))) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json', message: 'Expected JSON body.' },
      { status: 400 },
    );
  }

  try {
    const result = await handleTheoremControlCenterAction(body, process.env, new Date(), globalThis.fetch);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_control_center_action',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
