import { NextResponse } from 'next/server';

import {
  buildTheoremControlCenterStateLive,
  handleTheoremControlCenterAction,
} from '@/lib/theorem-control-center';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await buildTheoremControlCenterStateLive(process.env, new Date(), globalThis.fetch));
}

export async function POST(req: Request) {
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
