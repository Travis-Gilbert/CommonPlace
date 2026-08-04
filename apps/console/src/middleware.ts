import { NextRequest, NextResponse } from 'next/server';
import {
  rewriteOpenworkChatHtml,
  rewriteOpenworkLocation,
} from '@/lib/chat-openwork-proxy';

// SOURCING: none. SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL6 / OW4.
// When CONSOLE_WORKSPACE_URL is set, /chat is reverse-proxied to the workspace
// chat door with the /chat prefix stripped. Cookie stays on the console origin.
// NextResponse.rewrite cannot target an arbitrary external origin here, so this
// is an explicit fetch proxy. HTML root-absolute asset URLs are rewritten under
// /chat so Vite bundles do not 404 on the console origin (blank OpenWork page).

const WORKSPACE = process.env.CONSOLE_WORKSPACE_URL?.replace(/\/$/, '') ?? '';

export async function middleware(request: NextRequest) {
  if (!WORKSPACE) return NextResponse.next();

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

  const location = upstream.headers.get('location');
  if (location) {
    responseHeaders.set('location', rewriteOpenworkLocation(location) ?? location);
  }

  if (upstreamContentType.includes('text/html')) {
    const html = await upstream.text();
    const stamped = rewriteOpenworkChatHtml(html);
    // Content-Length from upstream is stale after rewrite.
    responseHeaders.delete('content-length');
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
