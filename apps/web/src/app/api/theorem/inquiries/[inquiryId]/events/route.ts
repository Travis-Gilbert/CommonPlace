import { forwardAuthHeaders, jsonResponse, localInquiryUrl } from '@/app/api/theorem/inquiries/_upstream';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ inquiryId: string }> },
) {
  const { inquiryId } = await context.params;
  if (!inquiryId?.trim()) {
    return jsonResponse({ error: 'missing_inquiry_id' }, 400);
  }

  try {
    const res = await fetch(
      localInquiryUrl(`/v1/inquiries/${encodeURIComponent(inquiryId)}/events`),
      {
        method: 'GET',
        headers: forwardAuthHeaders(req),
        cache: 'no-store',
      },
    );

    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'inquiry_events_unreachable',
        message: err instanceof Error ? err.message : String(err),
      },
      502,
    );
  }
}
