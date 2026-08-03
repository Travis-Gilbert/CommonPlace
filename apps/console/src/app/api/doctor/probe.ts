function extractImpl(html: string): string | null {
  const match =
    html.match(/data-register-impl="([^"]+)"/) ??
    html.match(/data-register-impl='([^']+)'/);
  return match?.[1] ?? null;
}

function canonicalRedirectUrl(currentUrl: string, response: Response): URL | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get('location');
  if (!location) return null;
  const current = new URL(currentUrl);
  const target = new URL(location, current);
  const normalizedPath = (pathname: string) => pathname.replace(/\/+$/, '');
  const isCanonical =
    target.origin === current.origin &&
    target.search === current.search &&
    normalizedPath(target.pathname) === normalizedPath(current.pathname) &&
    target.pathname !== current.pathname;
  return isCanonical ? target : null;
}

export async function probeRoute(
  base: string,
  route: string,
): Promise<{ status: number; impl: string | null; body: string }> {
  const url = route === '/' ? base : `${base}${route}`;
  let response = await fetch(url, { redirect: 'manual' });
  const canonicalUrl = canonicalRedirectUrl(url, response);
  if (canonicalUrl) {
    response = await fetch(canonicalUrl, { redirect: 'manual' });
  }
  const body = await response.text();
  const impl = response.headers.get('x-register-impl') ?? extractImpl(body);
  return { status: response.status, impl, body };
}
