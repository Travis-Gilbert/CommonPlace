const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();
const TENANT = process.env.THEOREM_TENANT_SLUG?.trim();
const PREVIEW_CONTENT_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
): Promise<Response> {
  const { assetId } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(assetId)) return new Response('not found', { status: 404 });
  if (!TENANT) return Response.json({ error: 'missing_theorem_tenant' }, { status: 503 });

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (MCP_TOKEN) headers.set('Authorization', `Bearer ${MCP_TOKEN}`);
  try {
    const upstream = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: 'graphql_query',
          arguments: {
            tenant: TENANT,
            query: 'query TopicPreviewAsset($assetId: String!) { topicPreviewAsset(assetId: $assetId) }',
            variables: { assetId },
          },
        },
      }),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
    const asset = topicPreviewAsset(payload);
    if (!upstream.ok || !asset) return new Response('not found', { status: 404 });
    if (asset.asset_id !== assetId) return new Response('not found', { status: 404 });
    const contentType = typeof asset.content_type === 'string' ? asset.content_type.toLowerCase() : '';
    const encoded = typeof asset.bytes_base64 === 'string' ? asset.bytes_base64 : '';
    if (!PREVIEW_CONTENT_TYPES.has(contentType) || !validBase64(encoded)) return new Response('not found', { status: 404 });
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length === 0) return new Response('not found', { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': contentType,
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new Response('topic preview substrate unavailable', { status: 502 });
  }
}

function topicPreviewAsset(payload: Record<string, unknown> | null): Record<string, unknown> | undefined {
  const result = objectValue(payload?.result);
  const structured = objectValue(result?.structuredContent) ?? objectValue(result?.structured_content) ?? result;
  return objectValue(objectValue(structured?.data)?.topicPreviewAsset);
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function validBase64(value: string): boolean {
  return value.length > 0
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}
