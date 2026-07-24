// SOURCING: none. Same-origin proxy for held topic preview bytes. Snapshot URLs
// from Theorem are CommonPlace-relative (`/api/theorem/topic-preview-assets/...`);
// this route never redirects to remote origin URLs.

import { readIndexerPreviewAsset } from '@/lib/server/indexer-harness';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly assetId: string }> },
): Promise<Response> {
  const { assetId } = await context.params;
  const result = await readIndexerPreviewAsset(assetId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
