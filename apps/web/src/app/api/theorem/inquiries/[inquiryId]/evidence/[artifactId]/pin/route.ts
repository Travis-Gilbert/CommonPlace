import { forwardAuthHeaders, jsonResponse, localInquiryUrl } from '@/app/api/theorem/inquiries/_upstream';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ inquiryId: string; artifactId: string }> },
) {
  const { inquiryId, artifactId } = await context.params;
  if (!inquiryId?.trim() || !artifactId?.trim()) {
    return jsonResponse({ error: 'missing_ids' }, 400);
  }

  try {
    const res = await fetch(
      localInquiryUrl(
        `/v1/inquiries/${encodeURIComponent(inquiryId)}/evidence/${encodeURIComponent(artifactId)}/pin`,
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...forwardAuthHeaders(req),
        },
        body: '{}',
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
        error: 'inquiry_pin_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
