// SOURCING: extracted search GraphQL transport. Same-origin BFF only.

import { forward } from '../objects/_upstream';

export const HIT_FIELDS = `
  doc
  byteRange { start end }
  lane
  scope { kind nodeId nodeIds }
  snippet
  title
  source
`;

export const FIND_FIELDS = `
  query
  results {
    hit { ${HIT_FIELDS} }
    score
    relation
    edges { id fromId toId type confidence }
  }
  lanes { lane seeded admitted degradedReason }
  scopesSearched
  lambda
  retrievalRef
`;

export const SCATTER_FIELDS = `
  query
  aspects {
    id
    label
    relation
    edges { target weight }
    seedHits { ${HIT_FIELDS} }
  }
  lambda
  labeler
  scopesSearched
  scene { sceneId package }
  sceneRefusal
  expandedFrom
  scatterRef
`;

export async function searchGraphql(
  field: string,
  query: string,
  variables: Readonly<Record<string, unknown>>,
): Promise<Response> {
  const upstream = await forward('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  const payload = await upstream.json().catch(() => null) as {
    readonly data?: Readonly<Record<string, unknown>>;
    readonly errors?: readonly { readonly message?: unknown }[];
    readonly error?: unknown;
    readonly message?: unknown;
  } | null;

  if (!upstream.ok) {
    return Response.json(
      {
        error:
          typeof payload?.error === 'string'
            ? payload.error
            : 'search_upstream_failed',
        message:
          typeof payload?.message === 'string'
            ? payload.message
            : `Search upstream returned status ${upstream.status}.`,
      },
      { status: upstream.status },
    );
  }
  const graphError = payload?.errors?.find(
    (error) => typeof error.message === 'string',
  )?.message;
  if (typeof graphError === 'string') {
    return Response.json(
      { error: 'search_graphql_error', message: graphError },
      { status: 502 },
    );
  }
  const data = payload?.data?.[field];
  if (data == null) {
    return Response.json(
      {
        error: 'search_response_missing',
        message: `Search GraphQL returned no ${field} payload.`,
      },
      { status: 502 },
    );
  }
  return Response.json({ data });
}

export function readObjectBody(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;
}

export function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function badRequest(message: string): Response {
  return Response.json(
    { error: 'invalid_search_request', message },
    { status: 400 },
  );
}
