// SOURCING: none. Same-origin adapter for A5 lifeCalendarWindow GraphQL.

import { NextResponse } from 'next/server';

import { readLifeCalendarWindow } from '@/lib/server/agent-address-harness';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    start?: string;
    end?: string;
    eventsJson?: string;
  };
  if (!body.start || !body.end || typeof body.eventsJson !== 'string') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const result = await readLifeCalendarWindow({
    windowStart: body.start,
    windowEnd: body.end,
    eventsJson: body.eventsJson,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ events: result.events });
}
