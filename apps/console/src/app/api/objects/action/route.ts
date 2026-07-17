// SOURCING: none. Same-origin proxy for POST /objects/action (R2.1).
import { forward } from '../_upstream';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return forward('/objects/action', { method: 'POST', body: await request.text() });
}
