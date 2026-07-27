// SOURCING: extracted F1/F5 same-origin adapter for the search GraphQL find query.

import {
  FIND_FIELDS,
  badRequest,
  nonEmptyText,
  readObjectBody,
  searchGraphql,
} from '../_graphql';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = readObjectBody(await request.json().catch(() => null));
  const query = nonEmptyText(body?.query);
  if (!query) return badRequest('Find requires a non-empty query.');
  if (!Array.isArray(body?.scopes) || !Array.isArray(body?.lanes)) {
    return badRequest('Find requires scope and lane arrays.');
  }
  return searchGraphql(
    'find',
    `query($query:String!,$scopes:[FindScopeInput!],$lanes:[FindLane!],$k:Int,$lambda:Float){
      find(query:$query, scopes:$scopes, lanes:$lanes, k:$k, lambda:$lambda){ ${FIND_FIELDS} }
    }`,
    {
      query,
      scopes: body.scopes,
      lanes: body.lanes,
      k: body.k,
      lambda: body.lambda,
    },
  );
}
