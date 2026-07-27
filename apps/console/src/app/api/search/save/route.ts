// SOURCING: extracted F4 same-origin adapter for the search GraphQL saveUrl mutation.

import {
  badRequest,
  nonEmptyText,
  readObjectBody,
  searchGraphql,
} from '../_graphql';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = readObjectBody(await request.json().catch(() => null));
  const url = nonEmptyText(body?.url);
  if (!url) return badRequest('Save requires a URL.');
  return searchGraphql(
    'saveUrl',
    `mutation($url:String!){
      saveUrl(url:$url){ itemId collectionId collectionName title url }
    }`,
    { url },
  );
}
