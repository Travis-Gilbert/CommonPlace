// SOURCING: commonplace-api rustyWebSearch GraphQL field over CONSOLE_DATA_API_URL.
// HANDOFF-CONSOLE-SINGLE-DOOR-1.0: no THEOREM_NODE_URL on this path.
// Search material is explicitly untrusted reference content: it can inform an
// answer but can never supply instructions for the agent to follow.
// Indexer search reuses the same endpoint with a higher limit and empty-ok.

import 'server-only';

import type { HarnessPrincipal } from '@/lib/harness-principal-core';
import { consumerGraphqlUrl } from '@/lib/server/consumer-graphql';
import { principalTenantHeaders } from '@/lib/server/harness-principal';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  credentialHeaders,
  resolveUpstreamCredential,
} from '@/lib/server/upstream-credential';
import { readWebResearchSources, type RustyWebSearchPayload, type WebResearchSource } from '@/lib/web-research-contract';

const DEFAULT_CHAT_LIMIT = 5;

/** Canonical live web providers from rustyred-web (SUPPORTED_SEARCH_PROVIDER_ALIASES). */
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

const RUSTY_WEB_SEARCH_QUERY = `
  query ConsoleRustyWebSearch($query: String!, $limit: Int, $providers: [String!]) {
    rustyWebSearch(query: $query, limit: $limit, providers: $providers)
  }
`;

/** Acquire fresh sources through the tenant-scoped data-API RustyWeb field. */
export async function loadWebResearch(
  query: string,
  principal: HarnessPrincipal,
  request: Request,
  options: LoadWebResearchOptions = {},
): Promise<WebResearchResult> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_CHAT_LIMIT, 20));
  const emptyOk = options.emptyOk === true;
  const endpoint = consumerGraphqlUrl();
  if (!endpoint) {
    return {
      ok: false,
      response: Response.json(
        { error: 'web_search_unconfigured', message: 'CONSOLE_DATA_API_URL is not configured for search.' },
        { status: 404 },
      ),
    };
  }

  const credential = await resolveUpstreamCredential(principal);
  if (!credential.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: 'web_search_credential_unavailable', message: 'No data-API credential for this principal.' },
        { status: 403 },
      ),
    };
  }

  const timeout = startHarnessRequestTimeout();
  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...credentialHeaders(credential.credential),
        ...principalTenantHeaders(principal),
      },
      body: JSON.stringify({
        query: RUSTY_WEB_SEARCH_QUERY,
        variables: {
          query,
          limit,
          providers: [...RUSTYWEB_LIVE_SEARCH_PROVIDERS],
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, timeout.signal]),
    });
  } catch (error) {
    if (request.signal.aborted) throw error;
    return {
      ok: false,
      response: Response.json(
        {
          error: timeout.didTimeout() ? 'web_search_timeout' : 'web_search_unreachable',
          message: 'RustyWeb could not be reached for this turn.',
        },
        { status: timeout.didTimeout() ? 504 : 502 },
      ),
    };
  } finally {
    timeout.clear();
  }

  const envelope = await upstream.json().catch(() => null) as {
    data?: { rustyWebSearch?: RustyWebSearchPayload };
    errors?: Array<{ message?: unknown }>;
  } | null;

  if (!upstream.ok || envelope?.errors || !envelope?.data?.rustyWebSearch) {
    const detail = envelope?.errors?.[0]?.message;
    return {
      ok: false,
      response: Response.json(
        {
          error: 'web_search_refused',
          message: typeof detail === 'string' ? detail : 'RustyWeb refused this search request.',
        },
        { status: upstream.ok ? 502 : upstream.status },
      ),
    };
  }

  const sources = readWebResearchSources(envelope.data.rustyWebSearch, limit);
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
