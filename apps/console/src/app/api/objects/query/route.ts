// SOURCING: none. Same-origin proxy for POST /objects/query (R2.1).
import { forward } from '../_upstream';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return forward('/objects/query', { method: 'POST', body: await request.text() });
}
