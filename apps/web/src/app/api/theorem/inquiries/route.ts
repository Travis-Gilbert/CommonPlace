import {
  forwardAuthHeaders,
  jsonResponse,
  localInquiryUrl,
  stripUntrustedTenantFields,
} from '@/app/api/theorem/inquiries/_upstream';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Expected JSON body.' }, 400);
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return jsonResponse({ error: 'missing_query', message: 'Inquiry requires query.' }, 400);
  }

  const upstreamBody = stripUntrustedTenantFields(body);

  try {
    const res = await fetch(localInquiryUrl('/v1/inquiries'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...forwardAuthHeaders(req),
      },
      body: JSON.stringify(upstreamBody),
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'inquiry_upstream_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
