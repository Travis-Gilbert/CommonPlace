import type { AttentionItem, ContractDescriptor } from '@commonplace/mobile-contracts';

import { readInstanceSettings } from './instance';

export class GqlError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GqlError';
  }
}

export async function instanceJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const settings = await readInstanceSettings();
  const headers = new Headers(init.headers);
  if (settings.apiKey) headers.set('x-api-key', settings.apiKey);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${settings.url.replace(/\/$/, '')}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) throw new GqlError(`HTTP ${response.status}`, response.status);
  return (await response.json()) as T;
}

export type MobileCapabilities = {
  web_search: boolean;
  contracts: ContractDescriptor[];
};

export const fetchMobileCapabilities = () => instanceJson<MobileCapabilities>('/capabilities');

export const fetchMobileAttention = () => instanceJson<AttentionItem[]>('/mobile/attention');

/** Minimal GraphQL-over-fetch client against the configured instance. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const settings = await readInstanceSettings();
  const res = await fetch(`${settings.url.replace(/\/$/, '')}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new GqlError(`HTTP ${res.status}`, res.status);
  const json = await res.json();
  if (json.errors?.length) throw new GqlError(json.errors.map((e: { message: string }) => e.message).join('; '));
  return json.data as T;
}
