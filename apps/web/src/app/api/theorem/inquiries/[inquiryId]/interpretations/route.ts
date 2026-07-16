import { forwardAuthHeaders, jsonResponse, localInquiryUrl } from '@/app/api/theorem/inquiries/_upstream';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ inquiryId: string }> },
) {
  const { inquiryId } = await context.params;
  if (!inquiryId?.trim()) {
    return jsonResponse({ error: 'missing_inquiry_id' }, 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Expected JSON body.' }, 400);
  }

  try {
    const res = await fetch(
      localInquiryUrl(`/v1/inquiries/${encodeURIComponent(inquiryId)}/interpretations`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...forwardAuthHeaders(req),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    );
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'inquiry_interpret_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
