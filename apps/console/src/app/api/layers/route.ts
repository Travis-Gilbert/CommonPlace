// SOURCING: mirrors rustyred-thg-core LayerRegistry::with_native_defaults via
// @commonplace/multiplex-layers NATIVE_LAYER_DESCRIPTORS until commonplace-api
// exports the live registry.

import { NATIVE_LAYER_DESCRIPTORS } from '@commonplace/multiplex-layers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json(
    { layers: NATIVE_LAYER_DESCRIPTORS },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
