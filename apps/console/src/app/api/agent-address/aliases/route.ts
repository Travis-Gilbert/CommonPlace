// SOURCING: none. Route handler for agent-address alias mint/list/revoke.

import { NextResponse } from 'next/server';
import {
  listAgentAliases,
  mintAgentAlias,
  revokeAgentAlias,
} from '@/lib/server/agent-address-harness';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export async function GET(request: Request) {
  void request;
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const userSlug = resolution.principal.tenant;
  const result = await listAgentAliases(userSlug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    aliases: result.aliases.map((row) => ({
      alias: row.alias,
      address: row.address,
      counterparty: row.counterparty,
      status: row.status,
    })),
    domain: result.domain,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    alias?: string;
    counterparty?: string;
  } | null;
  if (!body?.alias || !body.counterparty) {
    return NextResponse.json({ error: 'alias_and_counterparty_required' }, { status: 400 });
  }
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const result = await mintAgentAlias({
    alias: body.alias,
    userSlug: resolution.principal.tenant,
    counterparty: body.counterparty,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ alias: result.alias });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { alias?: string } | null;
  if (!body?.alias) {
    return NextResponse.json({ error: 'alias_required' }, { status: 400 });
  }
  const result = await revokeAgentAlias(body.alias);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ alias: result.alias });
}
