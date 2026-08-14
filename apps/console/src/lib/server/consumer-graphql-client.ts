// SOURCING: none. Authenticated HTTP transport for the CommonPlace consumer GraphQL API.

import 'server-only';

import { consumerGraphqlUrl } from '@/lib/server/consumer-graphql';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import {
  credentialHeaders,
  resolveUpstreamCredential,
} from '@/lib/server/upstream-credential';

export type ConsumerGraphqlFailureReason =
  | 'unconfigured'
  | 'unauthenticated'
  | 'credential_unavailable'
  | 'upstream_error'
  | 'timeout'
  | 'unreachable';

export type ConsumerGraphqlResult =
  | {
      readonly ok: true;
      readonly tenant: string;
      readonly data: Record<string, unknown>;
    }
  | {
      readonly ok: false;
      readonly status: number;
      readonly error: string;
      readonly reason: ConsumerGraphqlFailureReason;
    };

export async function executeConsumerGraphql(
  query: string,
  variables: Readonly<Record<string, unknown>>,
  errorPrefix: string,
): Promise<ConsumerGraphqlResult> {
  const endpoint = consumerGraphqlUrl();
  if (!endpoint) {
    return {
      ok: false,
      status: 404,
      error: `${errorPrefix}_graphql_unconfigured`,
      reason: 'unconfigured',
    };
  }

  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    const payload = await resolution.response.clone().json().catch(() => null) as {
      error?: unknown;
    } | null;
    return {
      ok: false,
      status: resolution.response.status,
      error: typeof payload?.error === 'string'
        ? payload.error
        : 'principal_resolution=unauthenticated',
      reason: 'unauthenticated',
    };
  }

  const credential = await resolveUpstreamCredential(resolution.principal);
  if (!credential.ok) {
    return {
      ok: false,
      status: 403,
      error: `${errorPrefix}_credential_unavailable`,
      reason: 'credential_unavailable',
    };
  }

  const timeout = startHarnessRequestTimeout();
  const graphqlPath = (() => {
    try {
      return new URL(endpoint).pathname || '/graphql';
    } catch {
      return '/graphql';
    }
  })();
  const body = JSON.stringify({ query, variables });

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...credentialHeaders(credential.credential, {
          method: 'POST',
          path: graphqlPath,
          body,
        }),
        ...principalTenantHeaders(resolution.principal),
      },
      body,
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
    } | null;
    if (!upstream.ok || (payload?.errors?.length ?? 0) > 0 || !payload?.data) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: typeof detail === 'string'
          ? detail
          : consumerTransportError(errorPrefix, timeout.didTimeout()),
        reason: timeout.didTimeout() ? 'timeout' : 'upstream_error',
      };
    }
    return {
      ok: true,
      tenant: resolution.principal.tenant,
      data: payload.data,
    };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: consumerTransportError(errorPrefix, timeout.didTimeout(), true),
      reason: timeout.didTimeout() ? 'timeout' : 'unreachable',
    };
  } finally {
    timeout.clear();
  }
}

function consumerTransportError(
  errorPrefix: string,
  timedOut: boolean,
  unreachable = false,
): string {
  if (timedOut) return `${errorPrefix}_graphql_timeout`;
  return `${errorPrefix}_graphql_${unreachable ? 'unreachable' : 'failed'}`;
}
