// SOURCING: none. Same-origin proxy for GET /objects/views (R2.1); also the
// cheap health probe the status bar's Reconnect affordance uses (R2.3).
import { forward } from '../_upstream';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return forward('/objects/views', { method: 'GET' });
}
