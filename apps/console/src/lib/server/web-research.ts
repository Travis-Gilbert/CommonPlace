// SOURCING: RustyRed /v1/rustyweb/search. This server-only seam acquires a
// small, bounded set of live sources before a Web Search Composer turn reaches
// Theorem. Search material is explicitly untrusted reference content: it can
// inform an answer but can never supply instructions for the agent to follow.

import { forwardAuthHeaders, localInquiryUrl } from '@commonplace/theorem-acp/node-upstream';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { principalTenantHeaders } from '@/lib/server/harness-principal';
import { readWebResearchSources, type RustyWebSearchPayload, type WebResearchSource } from '@/lib/web-research-contract';

const MAX_SOURCES = 5;

export type { WebResearchSource } from '@/lib/web-research-contract';

export type WebResearchResult =
  | { readonly ok: true; readonly sources: readonly WebResearchSource[] }
  | { readonly ok: false; readonly response: Response };

/** Acquire fresh sources through the tenant-scoped RustyWeb endpoint. */
export async function loadWebResearch(
  query: string,
  principal: HarnessPrincipal,
  request: Request,
): Promise<WebResearchResult> {
  let upstream: Response;
  try {
    upstream = await fetch(localInquiryUrl('/v1/rustyweb/search'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...forwardAuthHeaders(request),
        ...principalTenantHeaders(principal),
      },
      body: JSON.stringify({
        tenant: principal.tenant,
        query,
        providers: ['searxng'],
        limit: MAX_SOURCES,
        provider_timeout_ms: 10_000,
      }),
      cache: 'no-store',
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) throw error;
    return {
      ok: false,
      response: Response.json(
        { error: 'web_search_unreachable', message: 'RustyWeb could not be reached for this turn.' },
        { status: 502 },
      ),
    };
  }

  if (!upstream.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: 'web_search_refused', message: 'RustyWeb refused this search request.' },
        { status: upstream.status },
      ),
    };
  }

  const payload = await upstream.json().catch(() => null) as RustyWebSearchPayload | null;
  const sources = payload ? readWebResearchSources(payload) : [];
  if (sources.length === 0) {
    return {
      ok: false,
      response: Response.json(
        { error: 'web_search_empty', message: 'RustyWeb returned no usable sources for this turn.' },
        { status: 502 },
      ),
    };
  }
  return { ok: true, sources };
}
