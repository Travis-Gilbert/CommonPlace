// SOURCING: none. Route handler for Index calendar window overlap flags.

import { NextResponse } from 'next/server';
import { readLifeCalendarWindow } from '@/lib/server/agent-address-harness';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    windowStart?: string;
    windowEnd?: string;
    events?: unknown;
  } | null;
  if (!body?.windowStart || !body.windowEnd || !body.events) {
    return NextResponse.json({ error: 'window_and_events_required' }, { status: 400 });
  }
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const result = await readLifeCalendarWindow({
    windowStart: body.windowStart,
    windowEnd: body.windowEnd,
    eventsJson: JSON.stringify(body.events),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ events: result.events });
}
