// SOURCING: commonplace-api /capabilities. The Console asks the authenticated
// CommonPlace backend what it can actually do; it never exposes the upstream
// API key or assumes web search from a local UI preference.

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { principalTenantHeaders } from '@/lib/server/harness-principal';
import { upstreamBase, upstreamKey } from '@/app/api/objects/_upstream';

export interface InstanceCapabilities {
  readonly webSearch: boolean;
}

export type InstanceCapabilitiesResult =
  | { readonly ok: true; readonly capabilities: InstanceCapabilities }
  | { readonly ok: false; readonly response: Response };

/** Read the secret-backed, tenant-scoped capability document on the server. */
export async function loadInstanceCapabilities(
  principal: HarnessPrincipal | null,
): Promise<InstanceCapabilitiesResult> {
  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase()}/capabilities`, {
      headers: {
        'x-api-key': upstreamKey(),
        ...(principal ? principalTenantHeaders(principal) : {}),
      },
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: 'console_capabilities_unreachable', upstream: upstreamBase() },
        { status: 502 },
      ),
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: 'console_capabilities_refused', upstream: upstreamBase() },
        { status: upstream.status },
      ),
    };
  }

  const body = await upstream.json().catch(() => null) as { web_search?: unknown } | null;
  return { ok: true, capabilities: { webSearch: body?.web_search === true } };
}
