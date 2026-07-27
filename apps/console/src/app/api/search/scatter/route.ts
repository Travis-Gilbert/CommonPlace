// SOURCING: extracted F2 same-origin adapter for the search GraphQL scatter query.

import {
  SCATTER_FIELDS,
  badRequest,
  nonEmptyText,
  readObjectBody,
  searchGraphql,
} from '../_graphql';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = readObjectBody(await request.json().catch(() => null));
  const query = nonEmptyText(body?.query);
  if (!query) return badRequest('Scatter requires a non-empty query.');
  return searchGraphql(
    'scatter',
    `query($query:String!,$scopes:[FindScopeInput!],$k:Int,$lambda:Float){
      scatter(query:$query, scopes:$scopes, k:$k, lambda:$lambda){ ${SCATTER_FIELDS} }
    }`,
    {
      query,
      scopes: Array.isArray(body?.scopes) ? body.scopes : undefined,
      k: body?.k,
      lambda: body?.lambda,
    },
  );
}
