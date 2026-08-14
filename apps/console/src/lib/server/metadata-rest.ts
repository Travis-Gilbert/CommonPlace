// SOURCING: none. Server adapter for Twenty-shaped `/rest/metadata/*` on the
// harness node (rustyred-thg-server). Falls back to LocalDevMetadataStore.

import 'server-only';

import {
  principalTenantHeaders,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import { handleLocalDevMetadata } from '@/lib/server/local-dev-metadata-store';

function harnessMetadataBase(): string | null {
  const override = process.env.CONSOLE_METADATA_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  const harness = process.env.CONSOLE_HARNESS_URL?.trim();
  if (!harness) return null;
  return harness.replace(/\/(?:mcp)?\/?$/, '');
}

export async function forwardMetadataRest(
  method: string,
  segments: readonly string[],
  request: Request,
): Promise<Response> {
  const path = `/rest/metadata/${segments.map(encodeURIComponent).join('/')}`;
  const base = harnessMetadataBase();
  const url = new URL(request.url);
  const search = url.search; // includes leading ?

  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;

  if (!base) {
    if (process.env.NODE_ENV === 'production') {
      return new Response(JSON.stringify({ error: 'unconfigured', message: 'Harness metadata is unconfigured in production.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return handleLocalDevMetadata(method, segments, await request.clone().text().catch(() => null));
  }

  const bodyText =
    method === 'GET' || method === 'HEAD' || method === 'DELETE'
      ? null
      : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${base}${path}${search}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(bodyText !== null ? { 'Content-Type': 'application/json' } : {}),
        ...principalTenantHeaders(resolution.principal),
        ...(process.env.CONSOLE_HARNESS_TOKEN
          ? { Authorization: `Bearer ${process.env.CONSOLE_HARNESS_TOKEN}` }
          : {}),
      },
      body: bodyText,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return handleLocalDevMetadata(method, segments, bodyText);
  }

  // Unconfigured / missing route → local stand-in so settings UI stays usable.
  if (upstream.status === 502 || upstream.status === 503) {
    return handleLocalDevMetadata(method, segments, bodyText);
  }
  if (upstream.status === 404) {
    const text = await upstream.text();
    const listingObjects =
      method === 'GET' && segments.length === 1 && segments[0] === 'objects';
    if (listingObjects || text.includes('console_harness')) {
      return handleLocalDevMetadata(method, segments, bodyText);
    }
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const responseBody = await upstream.text();
  return new Response(responseBody, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}
