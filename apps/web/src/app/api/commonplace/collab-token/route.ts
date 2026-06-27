import { createHmac, randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 15 * 60;
const configuredUpstream = process.env.THEOREM_GRAPHQL_URL?.trim();
const UPSTREAM = (configuredUpstream || 'http://localhost:50090').replace(/\/+$/, '');
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';

function tokenSecret(): string | null {
  const explicit = process.env.COMMONPLACE_COLLAB_TOKEN_SECRET?.trim();
  if (explicit) return explicit;
  if (process.env.NODE_ENV !== 'production') {
    return (
      process.env.THEOREM_API_KEY
      ?? process.env.COMMONPLACE_API_KEY
      ?? process.env.AUTH_SECRET
      ?? 'dev-key'
    );
  }
  return null;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function documentNameFromBody(body: Record<string, unknown>): string | null {
  const documentName = typeof body.documentName === 'string' ? body.documentName.trim() : '';
  if (documentName) return documentName;

  const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : '';
  if (contentType === 'commonplace-page' && pageId) {
    return `commonplace-page:${pageId}`;
  }
  return null;
}

function ttlFromEnv(): number {
  const parsed = Number.parseInt(process.env.COMMONPLACE_COLLAB_TOKEN_TTL_SECONDS ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.min(parsed, MAX_TTL_SECONDS);
}

function sign(payloadBase64: string): string {
  const secret = tokenSecret();
  if (!secret) {
    throw new Error('COMMONPLACE_COLLAB_TOKEN_SECRET is required for collaboration tokens.');
  }
  return createHmac('sha256', secret).update(payloadBase64).digest('base64url');
}

async function verifyPage(pageId: string): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  try {
    const response = await fetch(`${UPSTREAM}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      cache: 'no-store',
      body: JSON.stringify({
        query: 'query($id:String!){ item(id:$id){ id kind } }',
        variables: { id: pageId },
      }),
    });
    if (!response.ok) {
      return { ok: false, status: 502, error: 'CommonPlace API unreachable.' };
    }
    const json = (await response.json()) as {
      data?: { item?: { id: string; kind: string } | null };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      return { ok: false, status: 502, error: 'CommonPlace API rejected the page lookup.' };
    }
    const item = json.data?.item;
    if (!item) {
      return { ok: false, status: 404, error: 'Page not found.' };
    }
    if (item.kind !== 'doc') {
      return { ok: false, status: 400, error: 'Collaboration is only available for pages.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: 'CommonPlace API unreachable.' };
  }
}

export async function POST(req: Request) {
  if (!tokenSecret()) {
    return Response.json(
      { error: 'COMMONPLACE_COLLAB_TOKEN_SECRET is required for collaboration tokens.' },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const documentName = documentNameFromBody(body);
  if (!documentName?.startsWith('commonplace-page:')) {
    return Response.json({ error: 'Unsupported collaboration document.' }, { status: 400 });
  }

  const pageId = documentName.slice('commonplace-page:'.length);
  if (!pageId) {
    return Response.json({ error: 'Page id is required.' }, { status: 400 });
  }

  const pageCheck = await verifyPage(pageId);
  if (!pageCheck.ok) {
    return Response.json({ error: pageCheck.error }, { status: pageCheck.status });
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = ttlFromEnv();
  const expiresAt = now + ttlSeconds;
  const payload = {
    v: 1,
    sub: 'commonplace-collab',
    documentName,
    pageId,
    iat: now,
    exp: expiresAt,
    nonce: randomBytes(12).toString('base64url'),
  };
  const payloadBase64 = base64url(JSON.stringify(payload));
  const token = `${payloadBase64}.${sign(payloadBase64)}`;

  return Response.json({
    token,
    documentName,
    expiresAt,
    ttlSeconds,
  });
}
