// SOURCING: none. Server-only identity proxy for the FK3 bulkhead.

import 'server-only';
import { auth } from '@/lib/auth';
import {
  BoundedRequestBodyError,
  readBoundedByteStream,
  readBoundedRequestBody,
} from '@/lib/server/bounded-request-body';

const MAX_JSON_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DOCUMENT_TIMEOUT_MS = 70_000;
const SERVICE_SECRET_PLACEHOLDER_PATTERNS = Object.freeze([
  /^(?:example|test)$/i,
  /^change[-_ ]me(?:[-_ ].*)?$/i,
  /^replace[-_ ]with(?:[-_ ].*)?$/i,
  /^same[-_ ]service[-_ ]secret(?:[-_ ].*)?$/i,
  /^set[-_ ]a[-_ ]random[-_ ]secret(?:[-_ ].*)?$/i,
]);

export interface ForkIdentityPrincipal {
  readonly subject: string;
  readonly username: string;
  readonly displayName: string | null;
  readonly email: string | null;
}

export interface ForkServerEnvironment {
  readonly COMMONPLACE_FORK_SERVER_URL?: string;
  readonly COMMONPLACE_FORK_SERVER_INTERNAL_KEY?: string;
  readonly NODE_ENV?: string;
}

export interface ForkServerConfig {
  readonly origin: string;
  readonly internalKey: string;
}

export class ForkIdentityProxyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ForkIdentityProxyError';
    this.status = status;
    this.code = code;
  }
}

export function resolveForkServerConfig(
  environment: ForkServerEnvironment = process.env,
): ForkServerConfig {
  const rawOrigin = environment.COMMONPLACE_FORK_SERVER_URL?.trim();
  const internalKey = environment.COMMONPLACE_FORK_SERVER_INTERNAL_KEY?.trim();
  if (!rawOrigin || !internalKey) {
    throw new ForkIdentityProxyError(
      503,
      'identity_service_unconfigured',
      'The CommonPlace identity service is not configured',
    );
  }
  if (
    internalKey.length < 32
    || SERVICE_SECRET_PLACEHOLDER_PATTERNS.some((pattern) =>
      pattern.test(internalKey))
  ) {
    throw new ForkIdentityProxyError(
      503,
      'identity_service_unconfigured',
      'The CommonPlace identity service credential is invalid',
    );
  }

  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new ForkIdentityProxyError(
      503,
      'identity_service_unconfigured',
      'The CommonPlace identity service URL is invalid',
    );
  }
  const localDevelopment =
    environment.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localDevelopment)) {
    throw new ForkIdentityProxyError(
      503,
      'identity_service_unconfigured',
      'The CommonPlace identity service must use HTTPS',
    );
  }
  if (url.hostname.toLowerCase().includes('rustyred')) {
    throw new ForkIdentityProxyError(
      503,
      'identity_service_boundary_refused',
      'The identity service must not target RustyRed',
    );
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';

  return Object.freeze({
    origin: url.toString().replace(/\/$/, ''),
    internalKey,
  });
}

export async function resolveForkIdentityPrincipal(): Promise<ForkIdentityPrincipal> {
  const session = await auth();
  const user = session?.user;
  if (!user?.harnessIdentity || !user.githubLogin) {
    throw new ForkIdentityProxyError(
      401,
      'identity_session_required',
      'Sign in with GitHub to continue',
    );
  }
  return Object.freeze({
    subject: user.harnessIdentity,
    username: user.githubLogin,
    displayName: user.name ?? null,
    email: user.email ?? null,
  });
}

interface ForkIdentityRequest {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: Readonly<Record<string, unknown>>;
  readonly publicRoute?: boolean;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly environment?: ForkServerEnvironment;
}

export interface ForkIdentityResponse {
  readonly status: number;
  readonly body: unknown;
}

async function readForkResponse(response: Response): Promise<ForkIdentityResponse> {
  const rawLength = response.headers.get('content-length');
  const declaredLength = rawLength === null ? null : Number(rawLength);
  if (
    declaredLength !== null
    && (
      !Number.isSafeInteger(declaredLength)
      || declaredLength < 0
      || declaredLength > MAX_RESPONSE_BYTES
    )
  ) {
    throw new ForkIdentityProxyError(
      502,
      'identity_response_too_large',
      'The identity service returned an oversized response',
    );
  }
  let bytes: ArrayBuffer;
  try {
    bytes = await readBoundedByteStream(response.body, MAX_RESPONSE_BYTES);
  } catch (error) {
    if (!(error instanceof BoundedRequestBodyError)) throw error;
    throw new ForkIdentityProxyError(
      502,
      'identity_response_too_large',
      'The identity service returned an oversized response',
    );
  }
  const text = Buffer.from(bytes).toString('utf8');
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ForkIdentityProxyError(
        502,
        'identity_response_invalid',
        'The identity service returned invalid JSON',
      );
    }
  }
  return { status: response.status, body: parsed };
}

export async function requestForkIdentity(
  path: string,
  {
    method = 'POST',
    body,
    publicRoute = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    environment,
  }: ForkIdentityRequest = {},
): Promise<ForkIdentityResponse> {
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  const parentSegment = pathname.split('/').some((segment) => {
    try {
      return decodeURIComponent(segment) === '..';
    } catch {
      return true;
    }
  });
  if (!path.startsWith('/v1/') || parentSegment) {
    throw new TypeError('Fork identity paths must begin with /v1/');
  }
  const config = resolveForkServerConfig(environment);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${config.origin}${path}`, {
      method,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(!publicRoute
          ? { authorization: `Bearer ${config.internalKey}` }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return await readForkResponse(response);
  } catch (error) {
    if (error instanceof ForkIdentityProxyError) throw error;
    throw new ForkIdentityProxyError(
      502,
      'identity_service_unreachable',
      error instanceof Error && error.name === 'AbortError'
        ? 'The identity service timed out'
        : 'The identity service is unreachable',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function requestForkDocumentIngest({
  workspaceId,
  principal,
  filename,
  mediaType,
  bytes,
  tags = [],
  fetchImpl = fetch,
  environment,
}: {
  readonly workspaceId: string;
  readonly principal: ForkIdentityPrincipal;
  readonly filename: string;
  readonly mediaType: string;
  readonly bytes: ArrayBuffer;
  readonly tags?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly environment?: ForkServerEnvironment;
}): Promise<ForkIdentityResponse> {
  if (
    typeof filename !== 'string'
    || filename.trim().length === 0
    || filename.length > 255
    || filename.includes('/')
    || filename.includes('\\')
    || Array.from(filename).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
    })
    || filename === '.'
    || filename === '..'
  ) {
    throw new ForkIdentityProxyError(
      400,
      'document_filename_invalid',
      'The document filename is invalid',
    );
  }
  const config = resolveForkServerConfig(environment);
  const normalizedMediaType = mediaType.trim();
  if (
    normalizedMediaType.length > 255
    || !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;\s*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/.test(
      normalizedMediaType,
    )
  ) {
    throw new ForkIdentityProxyError(
      415,
      'content_media_type_invalid',
      'The document media type is not supported',
    );
  }
  const endpoint = new URL(
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/documents`,
    config.origin,
  );
  endpoint.searchParams.set('filename', filename);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOCUMENT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.internalKey}`,
        'content-type': normalizedMediaType,
        'x-commonplace-principal': Buffer.from(JSON.stringify(principal)).toString('base64url'),
        'x-commonplace-tags': Buffer.from(JSON.stringify({ tags })).toString('base64url'),
      },
      body: bytes,
    });
    return await readForkResponse(response);
  } catch (error) {
    if (error instanceof ForkIdentityProxyError) throw error;
    throw new ForkIdentityProxyError(
      502,
      'content_ingest_unreachable',
      error instanceof Error && error.name === 'AbortError'
        ? 'Document ingestion timed out'
        : 'Document ingestion is unreachable',
    );
  } finally {
    clearTimeout(timer);
  }
}

export function forkIdentityErrorResponse(error: unknown): Response {
  if (error instanceof ForkIdentityProxyError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  return Response.json(
    {
      error: 'identity_proxy_error',
      message: 'The identity proxy could not complete the request',
    },
    { status: 500 },
  );
}

export function forkIdentityResponse(result: ForkIdentityResponse): Response {
  return Response.json(result.body, { status: result.status });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let bytes: ArrayBuffer;
  try {
    bytes = await readBoundedRequestBody(request, MAX_JSON_REQUEST_BYTES);
  } catch (error) {
    if (!(error instanceof BoundedRequestBodyError)) throw error;
    if (error.code === 'request_body_too_large') {
      throw new ForkIdentityProxyError(
        413,
        'identity_request_too_large',
        'The JSON request body exceeds the byte limit',
      );
    }
    throw new ForkIdentityProxyError(
      400,
      'identity_request_invalid',
      'The JSON request body length is invalid',
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new ForkIdentityProxyError(
      400,
      'identity_request_invalid',
      'A JSON request body is required',
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ForkIdentityProxyError(
      400,
      'identity_request_invalid',
      'The JSON request body must be an object',
    );
  }
  return value as Record<string, unknown>;
}
