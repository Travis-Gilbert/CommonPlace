// SOURCING: extracted transport contract. The package owns no server URL or credential.

import type {
  AspectId,
  FindRequest,
  FindResponse,
  FindScope,
  SaveUrlReceipt,
  ScatterResponse,
} from './contracts';

export interface ScatterRequest {
  readonly query: string;
  readonly scopes?: readonly FindScope[];
  readonly k: number;
  readonly lambda: number;
}

export interface ExpandRequest extends ScatterRequest {
  readonly aspectId: AspectId;
}

export interface SearchStackClient {
  readonly find: (
    request: FindRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<FindResponse>;
  readonly scatter: (
    request: ScatterRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<ScatterResponse>;
  readonly expand: (
    request: ExpandRequest,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<ScatterResponse>;
  readonly saveUrl: (url: string) => Promise<SaveUrlReceipt>;
}

export interface SearchStackClientOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly basePath?: string;
}

export function createSearchStackClient(
  options: SearchStackClientOptions = {},
): SearchStackClient {
  const request = options.fetch ?? globalThis.fetch;
  const basePath = (options.basePath ?? '/api/search').replace(/\/$/, '');

  return {
    find: (input, callOptions) =>
      post<FindResponse>(request, `${basePath}/find`, input, callOptions),
    scatter: (input, callOptions) =>
      post<ScatterResponse>(request, `${basePath}/scatter`, input, callOptions),
    expand: (input, callOptions) =>
      post<ScatterResponse>(request, `${basePath}/expand`, input, callOptions),
    saveUrl: (url) =>
      post<SaveUrlReceipt>(request, `${basePath}/save`, { url }),
  };
}

async function post<T>(
  fetcher: typeof globalThis.fetch,
  url: string,
  body: unknown,
  options: { readonly signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: options.signal,
  });
  const payload = await response.json().catch(() => null) as {
    readonly data?: T;
    readonly error?: unknown;
    readonly message?: unknown;
  } | null;
  if (!response.ok) {
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof payload?.error === 'string'
          ? payload.error
          : `Search request failed with status ${response.status}`;
    throw new Error(message);
  }
  if (!payload || !('data' in payload)) {
    throw new Error('Search request returned no data');
  }
  return payload.data as T;
}
