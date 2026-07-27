// SOURCING: extracted F2 same-origin adapter for the search GraphQL expand query.

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
  const aspectId = nonEmptyText(body?.aspectId);
  if (!query || !aspectId) {
    return badRequest('Expand requires a query and aspect id.');
  }
  return searchGraphql(
    'expand',
    `query($query:String!,$aspectId:String!,$scopes:[FindScopeInput!],$k:Int,$lambda:Float){
      expand(query:$query, aspectId:$aspectId, scopes:$scopes, k:$k, lambda:$lambda){ ${SCATTER_FIELDS} }
    }`,
    {
      query,
      aspectId,
      scopes: Array.isArray(body?.scopes) ? body.scopes : undefined,
      k: body?.k,
      lambda: body?.lambda,
    },
  );
}
