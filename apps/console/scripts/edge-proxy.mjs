// SOURCING: none. SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW5 / vscode-surface door.
// Public Railway $PORT front: WebSocket-capable /IDE → workspace code-server,
// everything else → the Next standalone server. Middleware fetch cannot upgrade
// websockets, so the IDE door cannot live in middleware.ts the way /chat does.

import { createHmac, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { Buffer } from 'node:buffer';

export const IDE_PREFIX = '/IDE';
export const REGISTER_IMPL = 'code-server.ide';
export const ACTIVE_WORKSPACE_COOKIE = 'cp_active_workspace';

/** Strip /IDE so code-server sees root paths; keep query string. */
export function stripIdePath(urlPath = '/') {
  const qIndex = urlPath.indexOf('?');
  const pathOnly = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
  const query = qIndex === -1 ? '' : urlPath.slice(qIndex);
  if (pathOnly === IDE_PREFIX || pathOnly === `${IDE_PREFIX}/`) {
    return `/${query}`;
  }
  if (pathOnly.startsWith(`${IDE_PREFIX}/`)) {
    return `${pathOnly.slice(IDE_PREFIX.length)}${query}`;
  }
  return `${pathOnly}${query}`;
}

export function resolveIdeUpstream(environment = process.env) {
  const explicit = environment.CONSOLE_IDE_WORKSPACE_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const chat = environment.CONSOLE_WORKSPACE_URL?.trim().replace(/\/$/, '');
  if (!chat) return '';
  try {
    const url = new URL(chat);
    url.port = environment.CONSOLE_IDE_WORKSPACE_PORT?.trim() || '8080';
    return url.origin;
  } catch {
    return '';
  }
}

function signature(payload, secret) {
  return createHmac('sha256', secret)
    .update('commonplace-active-workspace-v1\0')
    .update(payload)
    .digest('base64url');
}

export function decodeActiveWorkspaceCookie(value, secret, nowMs = Date.now()) {
  if (!value || !secret || secret.length < 32) return null;
  const [payload, candidateSignature, extra] = value.split('.');
  if (!payload || !candidateSignature || extra) return null;
  const expected = signature(payload, secret);
  const left = Buffer.from(candidateSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    !claims
    || claims.version !== 1
    || typeof claims.subject !== 'string'
    || typeof claims.workspaceId !== 'string'
    || typeof claims.expiresAt !== 'number'
    || claims.expiresAt <= Math.floor(nowMs / 1000)
  ) {
    return null;
  }
  return claims;
}

function cookieValue(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export function authorizeIdeRequest(req, environment = process.env) {
  const secret = environment.COMMONPLACE_ACTIVE_WORKSPACE_SECRET?.trim();
  if (!secret || secret.length < 32 || /^(?:change-me|example|test)$/i.test(secret)) {
    return {
      ok: false,
      status: 503,
      body: 'IDE door requires COMMONPLACE_ACTIVE_WORKSPACE_SECRET on the console edge.',
    };
  }
  const raw = cookieValue(req.headers.cookie, ACTIVE_WORKSPACE_COOKIE);
  if (!decodeActiveWorkspaceCookie(raw ?? '', secret)) {
    return {
      ok: false,
      status: 302,
      location: '/login?callbackUrl=%2FIDE',
    };
  }
  return { ok: true };
}

function rewriteLocation(value) {
  if (!value) return value;
  if (value.startsWith(IDE_PREFIX)) return value;
  if (value.startsWith('/')) return `${IDE_PREFIX}${value}`;
  if (value.startsWith('./') || value.startsWith('../')) return value;
  try {
    const url = new URL(value);
    if (url.pathname === '/' || !url.pathname.startsWith(IDE_PREFIX)) {
      url.pathname = `${IDE_PREFIX}${url.pathname === '/' ? '/' : url.pathname}`;
    }
    return url.toString();
  } catch {
    return value;
  }
}

function stampHtml(html) {
  if (html.includes('data-register-impl=')) return html;
  return html.replace(
    /<html([^>]*)>/i,
    `<html$1 data-register-impl="${REGISTER_IMPL}">`,
  );
}

function unavailableHtml(message) {
  return `<!doctype html><html data-register-impl="${REGISTER_IMPL}"><body><main data-ide-unavailable>${message}</main></body></html>`;
}

function proxyHeaders(req, targetHost) {
  const headers = { ...req.headers, host: targetHost };
  delete headers['content-length'];
  // code-server is private; console edge already authenticated the user.
  delete headers.authorization;
  return headers;
}

function writeAuthFailure(res, auth) {
  if (auth.status === 302 && auth.location) {
    res.writeHead(302, { Location: auth.location, 'x-register-impl': REGISTER_IMPL });
    res.end();
    return;
  }
  res.writeHead(auth.status || 401, {
    'content-type': 'text/html; charset=utf-8',
    'x-register-impl': REGISTER_IMPL,
  });
  res.end(unavailableHtml(auth.body || 'IDE unauthorized'));
}

export function createEdgeProxy({
  nextOrigin,
  ideUpstream,
  environment = process.env,
  listenHost = '0.0.0.0',
  listenPort,
}) {
  const nextUrl = new URL(nextOrigin);
  const ideUrl = ideUpstream ? new URL(ideUpstream) : null;

  const server = http.createServer((req, res) => {
    const pathWithQuery = req.url || '/';
    const pathname = pathWithQuery.split('?')[0] || '/';

    if (pathname === IDE_PREFIX || pathname.startsWith(`${IDE_PREFIX}/`)) {
      if (!ideUrl) {
        // Fall through to Next so the App Router fallback page can explain.
        forwardToNext(req, res, nextUrl, pathWithQuery);
        return;
      }
      if (pathname === IDE_PREFIX) {
        res.writeHead(302, { Location: `${IDE_PREFIX}/${pathWithQuery.includes('?') ? pathWithQuery.slice(pathWithQuery.indexOf('?')) : ''}` });
        res.end();
        return;
      }
      const auth = authorizeIdeRequest(req, environment);
      if (!auth.ok) {
        writeAuthFailure(res, auth);
        return;
      }
      forwardToIde(req, res, ideUrl, stripIdePath(pathWithQuery));
      return;
    }

    forwardToNext(req, res, nextUrl, pathWithQuery);
  });

  server.on('upgrade', (req, socket, head) => {
    const pathWithQuery = req.url || '/';
    const pathname = pathWithQuery.split('?')[0] || '/';
    if (pathname === IDE_PREFIX || pathname.startsWith(`${IDE_PREFIX}/`)) {
      if (!ideUrl) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const auth = authorizeIdeRequest(req, environment);
      if (!auth.ok) {
        socket.write(`HTTP/1.1 ${auth.status || 401} Unauthorized\r\nConnection: close\r\n\r\n`);
        socket.destroy();
        return;
      }
      upgradeToIde(req, socket, head, ideUrl, stripIdePath(pathWithQuery));
      return;
    }
    upgradeToNext(req, socket, head, nextUrl, pathWithQuery);
  });

  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(listenPort, listenHost, resolve);
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function forwardToNext(req, res, nextUrl, pathWithQuery) {
  const headers = proxyHeaders(req, nextUrl.host);
  const upstream = http.request(
    {
      protocol: nextUrl.protocol,
      hostname: nextUrl.hostname,
      port: nextUrl.port || (nextUrl.protocol === 'https:' ? 443 : 80),
      path: pathWithQuery,
      method: req.method,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Next upstream unreachable: ${error.message}`);
  });
  req.pipe(upstream);
}

function forwardToIde(req, res, ideUrl, upstreamPath) {
  const headers = proxyHeaders(req, ideUrl.host);
  headers['x-forwarded-prefix'] = IDE_PREFIX;
  const upstream = http.request(
    {
      protocol: ideUrl.protocol,
      hostname: ideUrl.hostname,
      port: ideUrl.port || (ideUrl.protocol === 'https:' ? 443 : 80),
      path: upstreamPath,
      method: req.method,
      headers,
    },
    (up) => {
      const outHeaders = { ...up.headers, 'x-register-impl': REGISTER_IMPL };
      if (outHeaders.location) {
        outHeaders.location = rewriteLocation(String(outHeaders.location));
      }
      const contentType = String(outHeaders['content-type'] || '');
      if (contentType.includes('text/html')) {
        const chunks = [];
        up.on('data', (chunk) => chunks.push(chunk));
        up.on('end', () => {
          const html = stampHtml(Buffer.concat(chunks).toString('utf8'));
          const body = Buffer.from(html, 'utf8');
          outHeaders['content-length'] = String(body.length);
          res.writeHead(up.statusCode || 502, outHeaders);
          res.end(body);
        });
        return;
      }
      res.writeHead(up.statusCode || 502, outHeaders);
      up.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, {
      'content-type': 'text/html; charset=utf-8',
      'x-register-impl': REGISTER_IMPL,
    });
    res.end(unavailableHtml(`Workspace IDE door unreachable: ${error.message}`));
  });
  req.pipe(upstream);
}

function upgradeToNext(req, socket, head, nextUrl, pathWithQuery) {
  const headers = proxyHeaders(req, nextUrl.host);
  const upstream = http.request({
    protocol: nextUrl.protocol,
    hostname: nextUrl.hostname,
    port: nextUrl.port || (nextUrl.protocol === 'https:' ? 443 : 80),
    path: pathWithQuery,
    method: 'GET',
    headers,
  });
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upRes.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n')}\r\n\r\n`,
    );
    if (upHead?.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
  if (head?.length) upstream.write(head);
}

function upgradeToIde(req, socket, head, ideUrl, upstreamPath) {
  const headers = proxyHeaders(req, ideUrl.host);
  headers['x-forwarded-prefix'] = IDE_PREFIX;
  const upstream = http.request({
    protocol: ideUrl.protocol,
    hostname: ideUrl.hostname,
    port: ideUrl.port || (ideUrl.protocol === 'https:' ? 443 : 80),
    path: upstreamPath,
    method: 'GET',
    headers,
  });
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upRes.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n')}\r\n\r\n`,
    );
    if (upHead?.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
  if (head?.length) upstream.write(head);
}

export async function startEdgeProxyFromEnv(environment = process.env) {
  const publicPort = Number(environment.PORT || 3000);
  const nextPort = Number(environment.CONSOLE_NEXT_INTERNAL_PORT || 3010);
  const ideUpstream = resolveIdeUpstream(environment);
  const proxy = createEdgeProxy({
    nextOrigin: `http://127.0.0.1:${nextPort}`,
    ideUpstream,
    environment,
    listenPort: publicPort,
  });
  await proxy.listen();
  console.log(
    `edge-proxy: public :${publicPort} → next :${nextPort}`
      + (ideUpstream ? `, ${IDE_PREFIX} → ${ideUpstream}` : ` (no ${IDE_PREFIX} upstream)`),
  );
  return { proxy, nextPort, publicPort, ideUpstream };
}
