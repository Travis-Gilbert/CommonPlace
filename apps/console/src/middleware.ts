import { NextRequest, NextResponse } from 'next/server';

// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 CR-006.
// Product /chat is the Theorem register (Next page), not the workspace OpenWork
// door. Emergency rollback: set CONSOLE_OPENWORK_CHAT_PROXY=1 to restore the
// former reverse-proxy to CONSOLE_WORKSPACE_URL (:8787).

const WORKSPACE = process.env.CONSOLE_WORKSPACE_URL?.replace(/\/$/, '') ?? '';
const OPENWORK_PROXY =
  process.env.CONSOLE_OPENWORK_CHAT_PROXY?.trim() === '1';

export async function middleware(request: NextRequest) {
  if (!OPENWORK_PROXY || !WORKSPACE) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/chat')) return NextResponse.next();

  const upstreamPath = pathname === '/chat' ? '/' : pathname.replace(/^\/chat/, '') || '/';
  const target = new URL(upstreamPath + request.nextUrl.search, WORKSPACE);

  const headers = new Headers();
  const accept = request.headers.get('accept');
  const requestContentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');
  if (accept) headers.set('accept', accept);
  if (requestContentType) headers.set('content-type', requestContentType);
  if (cookie) headers.set('cookie', cookie);
  headers.set('x-forwarded-host', request.headers.get('host') ?? '');
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  const token = process.env.CONSOLE_WORKSPACE_TOKEN?.trim();
  if (token) headers.set('authorization', `Bearer ${token}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    return new NextResponse(
      `<!doctype html><html data-register-impl="openwork.chat"><body><main data-workspace-unavailable>Workspace chat door unreachable: ${
        error instanceof Error ? error.message : String(error)
      }</main></body></html>`,
      {
        status: 502,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-register-impl': 'openwork.chat',
        },
      },
    );
  }

  const upstreamContentType = upstream.headers.get('content-type') ?? '';
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('x-register-impl', 'openwork.chat');

  if (upstreamContentType.includes('text/html')) {
    const html = await upstream.text();
    const stamped = html.includes('data-register-impl=')
      ? html
      : html.replace(
          /<html([^>]*)>/i,
          '<html$1 data-register-impl="openwork.chat">',
        );
    return new NextResponse(stamped, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const config = {
  matcher: ['/chat', '/chat/:path*'],
};
