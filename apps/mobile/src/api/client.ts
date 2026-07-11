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
