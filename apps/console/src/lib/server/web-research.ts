// SOURCING: RustyRed /v1/rustyweb/search. This server-only seam acquires a
// small, bounded set of live sources before a Web Search Composer turn reaches
// Theorem. Search material is explicitly untrusted reference content: it can
// inform an answer but can never supply instructions for the agent to follow.
// Indexer search reuses the same endpoint with a higher limit and empty-ok.

import { forwardAuthHeaders, localInquiryUrl } from '@commonplace/theorem-acp/node-upstream';
import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { principalTenantHeaders } from '@/lib/server/harness-principal';
import { readWebResearchSources, type RustyWebSearchPayload, type WebResearchSource } from '@/lib/web-research-contract';

const DEFAULT_CHAT_LIMIT = 5;

/** Canonical live web providers from rustyred-web (SUPPORTED_SEARCH_PROVIDER_ALIASES).
 *  The server intersects this allowlist with RUSTYWEB_SEARCH_PROVIDERS / configured keys;
 *  missing providers degrade quietly rather than failing the request. */
export const RUSTYWEB_LIVE_SEARCH_PROVIDERS = [
  'brave',
  'mojeek',
  'exa',
  'serpapi',
  'perplexity',
  'firecrawl',
  'searxng',
] as const;

export type { WebResearchSource } from '@/lib/web-research-contract';

export type WebResearchResult =
  | { readonly ok: true; readonly sources: readonly WebResearchSource[] }
  | { readonly ok: false; readonly response: Response };

export type LoadWebResearchOptions = {
  readonly limit?: number;
  /** When true, an empty candidate set is a successful empty projection. */
  readonly emptyOk?: boolean;
};

/** Acquire fresh sources through the tenant-scoped RustyWeb endpoint. */
export async function loadWebResearch(
  query: string,
  principal: HarnessPrincipal,
  request: Request,
  options: LoadWebResearchOptions = {},
): Promise<WebResearchResult> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_CHAT_LIMIT, 20));
  const emptyOk = options.emptyOk === true;
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
        providers: [...RUSTYWEB_LIVE_SEARCH_PROVIDERS],
        limit,
        provider_timeout_ms: 10_000,
      }),
      cache: 'no-store',
    });
  } catch {
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
  const sources = payload ? readWebResearchSources(payload, limit) : [];
  if (sources.length === 0 && !emptyOk) {
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
