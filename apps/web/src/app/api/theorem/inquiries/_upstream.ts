// SOURCING: none — pure logic, no upstream component applies

export const dynamic = 'force-dynamic';

function resolveInquiryUpstreamBase(): string {
  const configured =
    process.env.THEOREM_NODE_URL?.trim() ||
    process.env.INQUIRY_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_LOCAL_NODE_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  // Railway / hosted CommonPlace must not default to the desktop loopback node.
  if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
    return 'https://api.theoremharness.com';
  }
  return 'http://127.0.0.1:17888';
}

export function localInquiryUrl(path: string): string {
  const base = resolveInquiryUpstreamBase();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function forwardAuthHeaders(req: Request): HeadersInit {
  const headers: Record<string, string> = {};
  const authorization = req.headers.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
    return headers;
  }
  const token =
    process.env.THEOREM_API_TOKEN?.trim() ||
    process.env.THEOREM_AGENT_API_TOKEN?.trim() ||
    process.env.THEOREM_AGENT_API_BEARER?.trim() ||
    process.env.RUSTYRED_AGENT_BEARER?.trim();
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

export function stripUntrustedTenantFields(body: Record<string, unknown>): Record<string, unknown> {
  const { tenant: _tenant, tenant_id: _tenantId, ...rest } = body;
  return rest;
}

export function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
