// SOURCING: none. Pure logic, no upstream component applies.
// Theorem node base resolution plus auth forwarding, extracted with the ACP
// modules (R2.2): the hosted ACP WebSocket URL and every HTTP call to the
// node derive from this one base, and the bearer rides either the incoming
// request's Authorization or the configured token env.

function resolveTheoremNodeBase(): string {
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
  const base = resolveTheoremNodeBase();
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
