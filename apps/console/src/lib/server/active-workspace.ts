import { createHmac, timingSafeEqual } from 'node:crypto';

export const ACTIVE_WORKSPACE_COOKIE = 'cp_active_workspace';
export const ACTIVE_WORKSPACE_TTL_SECONDS = 8 * 60 * 60;

export interface ActiveWorkspaceClaims {
  readonly version: 1;
  readonly subject: string;
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly tenant: string;
  readonly scopeRef: string;
  readonly expiresAt: number;
}

function admittedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= maxLength;
}

export function resolveActiveWorkspaceSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const secret = environment.COMMONPLACE_ACTIVE_WORKSPACE_SECRET?.trim();
  if (!secret) return null;
  if (secret.length < 32 || /^(?:change-me|example|test)$/i.test(secret)) {
    return null;
  }
  return secret;
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update('commonplace-active-workspace-v1\0')
    .update(payload)
    .digest('base64url');
}

export function encodeActiveWorkspaceClaims(
  input: Omit<ActiveWorkspaceClaims, 'version' | 'expiresAt'>,
  secret: string,
  nowMs = Date.now(),
): string {
  if (
    !admittedText(input.subject, 160)
    || !admittedText(input.workspaceId, 80)
    || !admittedText(input.workspaceSlug, 80)
    || !admittedText(input.tenant, 160)
    || !admittedText(input.scopeRef, 255)
    || secret.length < 32
  ) {
    throw new TypeError('Active workspace claims or secret are invalid');
  }
  const claims: ActiveWorkspaceClaims = {
    version: 1,
    ...input,
    expiresAt: Math.floor(nowMs / 1000) + ACTIVE_WORKSPACE_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function decodeActiveWorkspaceClaims(
  value: string,
  secret: string,
  nowMs = Date.now(),
): ActiveWorkspaceClaims | null {
  const [payload, candidateSignature, extra] = value.split('.');
  if (!payload || !candidateSignature || extra || secret.length < 32) return null;
  const expected = signature(payload, secret);
  const left = Buffer.from(candidateSignature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
  const record = claims as Record<string, unknown>;
  if (
    record.version !== 1
    || !admittedText(record.subject, 160)
    || !admittedText(record.workspaceId, 80)
    || !admittedText(record.workspaceSlug, 80)
    || !admittedText(record.tenant, 160)
    || !admittedText(record.scopeRef, 255)
    || !Number.isSafeInteger(record.expiresAt)
    || Number(record.expiresAt) <= Math.floor(nowMs / 1000)
  ) {
    return null;
  }
  return Object.freeze({
    version: 1,
    subject: record.subject,
    workspaceId: record.workspaceId,
    workspaceSlug: record.workspaceSlug,
    tenant: record.tenant,
    scopeRef: record.scopeRef,
    expiresAt: Number(record.expiresAt),
  });
}
