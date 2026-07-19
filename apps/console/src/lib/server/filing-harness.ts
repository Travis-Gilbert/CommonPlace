// SOURCING: none. Server-only GraphQL adapter for the filing engine's Index
// projection and its reversible corrections. It is the sole module that knows
// the upstream credential and tenant headers, matching the shape
// proactivity-harness.ts established.

import 'server-only';

import type {
  DigestGroup,
  FiledItem,
  FilingReceipt,
  FilingRule,
  IndexCollection,
  UrgentEvent,
} from '@/lib/filing/types';
import { startHarnessRequestTimeout } from '@/lib/server/harness-timeout';
import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';

export type FilingRead<T> =
  | { readonly ok: true; readonly tenant: string; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error: string };

const RECEIPT_FIELDS = `
  receipt {
    item
    tier
    confidence
    lowConfidence
    actor { kind id }
    attribution {
      kind
      precedent
      ruleId
      reason
      features { name weight }
    }
  }
`;

const INDEX_QUERY = `
  query ConsoleIndex($since: String!) {
    indexCollections { id name kind }
    recentlyFiled(since: $since) {
      item
      title
      source
      destination
      filedAtMs
      ${RECEIPT_FIELDS}
    }
  }
`;

const DIGEST_QUERY = `
  query ConsoleDigest($since: String!) {
    digest(since: $since) {
      destination { id name kind }
      items { item title source destination filedAtMs ${RECEIPT_FIELDS} }
    }
  }
`;

const RULES_QUERY = `
  query ConsoleFilingRules {
    filingRules {
      id
      destination
      urgent
      state
      reason
      sievePreview
      proposedBy { kind id }
      predicates { kind value }
    }
  }
`;

const URGENT_QUERY = `
  query ConsoleUrgent($since: String!) {
    urgentEvents(since: $since) { id item title reason atMs ${RECEIPT_FIELDS} }
  }
`;

const EXPLAIN_QUERY = `
  query ConsoleFilingExplain($item: String!) {
    filingExplain(item: $item) {
      item
      tier
      confidence
      lowConfidence
      actor { kind id }
      attribution { kind precedent ruleId reason features { name weight } }
    }
  }
`;

function graphqlUrl(): string | null {
  const explicit = process.env.THEOREM_GRAPHQL_URL;
  if (explicit) return explicit;
  const base = process.env.CONSOLE_HARNESS_URL;
  return base ? `${base.replace(/\/$/, '')}/graphql` : null;
}

async function executeGraphql(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<
  | { readonly ok: true; readonly tenant: string; readonly data: Record<string, unknown> }
  | { readonly ok: false; readonly status: number; readonly error: string }
> {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return { ok: false, status: resolution.response.status, error: 'principal_resolution=unauthenticated' };
  }
  const endpoint = graphqlUrl();
  if (!endpoint) return { ok: false, status: 404, error: 'filing_graphql_unconfigured' };
  const timeout = startHarnessRequestTimeout();
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
        ...(process.env.THEOREM_API_KEY ? { 'x-api-key': process.env.THEOREM_API_KEY } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: timeout.signal,
    });
    const payload = await upstream.json().catch(() => null) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message?: unknown }>;
    } | null;
    if (!upstream.ok || payload?.errors || !payload?.data) {
      const detail = payload?.errors?.[0]?.message;
      return {
        ok: false,
        status: upstream.ok ? 502 : upstream.status,
        error: typeof detail === 'string' ? detail : 'filing_graphql_failed',
      };
    }
    return { ok: true, tenant: resolution.principal.tenant, data: payload.data };
  } catch {
    return {
      ok: false,
      status: timeout.didTimeout() ? 504 : 502,
      error: timeout.didTimeout() ? 'filing_graphql_timeout' : 'filing_graphql_unreachable',
    };
  } finally {
    timeout.clear();
  }
}

export interface IndexProjection {
  readonly collections: readonly IndexCollection[];
  readonly recentlyFiled: readonly FiledItem[];
}

/** The Index surface's read: the shelves, and the trailing ribbon window. */
export async function readIndex(sinceMs: number): Promise<FilingRead<IndexProjection>> {
  const result = await executeGraphql(INDEX_QUERY, { since: String(sinceMs) });
  if (!result.ok) return result;
  const collections = result.data.indexCollections;
  const recentlyFiled = result.data.recentlyFiled;
  if (!Array.isArray(collections) || !Array.isArray(recentlyFiled)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_projection' };
  }
  return {
    ok: true,
    tenant: result.tenant,
    data: {
      collections: collections as IndexCollection[],
      recentlyFiled: recentlyFiled as FiledItem[],
    },
  };
}

/** F2: pulled, never pushed. Nothing about this read generates a notification. */
export async function readDigest(sinceMs: number): Promise<FilingRead<readonly DigestGroup[]>> {
  const result = await executeGraphql(DIGEST_QUERY, { since: String(sinceMs) });
  if (!result.ok) return result;
  const groups = result.data.digest;
  if (!Array.isArray(groups)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_digest' };
  }
  return { ok: true, tenant: result.tenant, data: groups as DigestGroup[] };
}

export async function readRules(): Promise<FilingRead<readonly FilingRule[]>> {
  const result = await executeGraphql(RULES_QUERY);
  if (!result.ok) return result;
  const rules = result.data.filingRules;
  if (!Array.isArray(rules)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_rules' };
  }
  return { ok: true, tenant: result.tenant, data: rules as FilingRule[] };
}

export async function readUrgent(sinceMs: number): Promise<FilingRead<readonly UrgentEvent[]>> {
  const result = await executeGraphql(URGENT_QUERY, { since: String(sinceMs) });
  if (!result.ok) return result;
  const events = result.data.urgentEvents;
  if (!Array.isArray(events)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_urgent' };
  }
  return { ok: true, tenant: result.tenant, data: events as UrgentEvent[] };
}

/** F3: why is this here, in one tap. */
export async function explainFiling(item: string): Promise<FilingRead<FilingReceipt | null>> {
  const result = await executeGraphql(EXPLAIN_QUERY, { item });
  if (!result.ok) return result;
  const receipt = result.data.filingExplain;
  if (receipt !== null && (typeof receipt !== 'object' || Array.isArray(receipt))) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_receipt' };
  }
  return { ok: true, tenant: result.tenant, data: (receipt ?? null) as FilingReceipt | null };
}

function receiptFrom(data: Record<string, unknown>): FilingReceipt | null {
  const receipt = Object.values(data)[0];
  return receipt && typeof receipt === 'object' && !Array.isArray(receipt)
    ? receipt as FilingReceipt
    : null;
}

/** A correction is a move plus an undo, never an approval. */
export async function correctFiling(
  item: string,
  to: string,
): Promise<FilingRead<FilingReceipt>> {
  const mutation = await executeGraphql(
    `mutation CorrectFiling($item: String!, $to: String!) {
      correctFiling(item: $item, to: $to) {
        item destination tier confidence lowConfidence
        actor { kind id }
        attribution { kind precedent ruleId reason features { name weight } }
      }
    }`,
    { item, to },
  );
  if (!mutation.ok) return mutation;
  const receipt = receiptFrom(mutation.data);
  if (!receipt) return { ok: false, status: 502, error: 'filing_graphql_invalid_receipt' };
  return { ok: true, tenant: mutation.tenant, data: receipt };
}

export async function undoFiling(item: string): Promise<FilingRead<FilingReceipt>> {
  const mutation = await executeGraphql(
    `mutation UndoFiling($item: String!) {
      undoFiling(item: $item) {
        item destination tier confidence lowConfidence
        actor { kind id }
        attribution { kind precedent ruleId reason features { name weight } }
      }
    }`,
    { item },
  );
  if (!mutation.ok) return mutation;
  const receipt = receiptFrom(mutation.data);
  if (!receipt) return { ok: false, status: 502, error: 'filing_graphql_invalid_receipt' };
  return { ok: true, tenant: mutation.tenant, data: receipt };
}

/** F4: consent activates an agent proposal; deny dismisses it with nothing
 *  applied. Both are the plugin spec's pending-consent pattern, reused. */
export async function consentRule(id: string): Promise<FilingRead<FilingRule>> {
  const mutation = await executeGraphql(
    `mutation ConsentRule($id: String!) {
      consentRule(id: $id) {
        id destination urgent state reason sievePreview
        proposedBy { kind id }
        predicates { kind value }
      }
    }`,
    { id },
  );
  if (!mutation.ok) return mutation;
  const rule = Object.values(mutation.data)[0];
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_rule' };
  }
  return { ok: true, tenant: mutation.tenant, data: rule as FilingRule };
}

export async function denyRule(id: string): Promise<FilingRead<true>> {
  const mutation = await executeGraphql(
    'mutation DenyRule($id: String!) { denyRule(id: $id) }',
    { id },
  );
  if (!mutation.ok) return mutation;
  if (Object.values(mutation.data)[0] !== true) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_deny' };
  }
  return { ok: true, tenant: mutation.tenant, data: true };
}

export async function putRule(rule: {
  readonly id?: string;
  readonly predicates: ReadonlyArray<{ readonly kind: string; readonly value: string }>;
  readonly destination: string;
  readonly urgent: boolean;
}): Promise<FilingRead<FilingRule>> {
  const mutation = await executeGraphql(
    `mutation PutFilingRule($rule: FilingRuleInput!) {
      putFilingRule(rule: $rule) {
        id destination urgent state reason sievePreview
        proposedBy { kind id }
        predicates { kind value }
      }
    }`,
    { rule },
  );
  if (!mutation.ok) return mutation;
  const saved = Object.values(mutation.data)[0];
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_rule' };
  }
  return { ok: true, tenant: mutation.tenant, data: saved as FilingRule };
}

export async function deleteRule(id: string): Promise<FilingRead<true>> {
  const mutation = await executeGraphql(
    'mutation DeleteFilingRule($id: String!) { deleteFilingRule(id: $id) }',
    { id },
  );
  if (!mutation.ok) return mutation;
  if (Object.values(mutation.data)[0] !== true) {
    return { ok: false, status: 502, error: 'filing_graphql_invalid_delete' };
  }
  return { ok: true, tenant: mutation.tenant, data: true };
}
