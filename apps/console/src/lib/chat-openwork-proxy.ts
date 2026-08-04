/** Rewrite OpenWork HTML so root-absolute assets load under the /chat proxy prefix.
 *
 * The workspace Vite app emits `/assets/...` and `/favicon-...` URLs. Middleware
 * only proxies `/chat/*`, so those root paths 404 on the console origin and the
 * page paints blank. Prefix them with `/chat` (already forwarded upstream).
 */
export function rewriteOpenworkChatHtml(html: string): string {
  let out = html.includes('data-register-impl=')
    ? html
    : html.replace(
        /<html([^>]*)>/i,
        '<html$1 data-register-impl="openwork.chat">',
      );

  // Attribute URLs: src="/assets/x", href="/favicon.png", etc.
  out = out.replace(
    /\b(href|src|poster)=(["'])\/(?!\/|chat\/)/g,
    '$1=$2/chat/',
  );

  // Inline modulepreload / import maps occasionally use content URLs.
  out = out.replace(
    /\b(url)\((["']?)\/(?!\/|chat\/)/g,
    '$1($2/chat/',
  );

  return out;
}

export function rewriteOpenworkLocation(location: string | null): string | null {
  if (!location) return location;
  if (location.startsWith('/chat/') || location === '/chat') return location;
  if (location.startsWith('/')) return `/chat${location === '/' ? '/' : location}`;
  try {
    const url = new URL(location);
    if (!url.pathname.startsWith('/chat')) {
      url.pathname = `/chat${url.pathname === '/' ? '/' : url.pathname}`;
    }
    return url.toString();
  } catch {
    return location;
  }
}
