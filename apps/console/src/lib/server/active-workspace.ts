// SOURCING: node:crypto createHmac and timingSafeEqual. A signed, short-lived
// claim set is what jose or jsonwebtoken model, and neither is in this app's
// dependency graph: pulling one in would carry JWK resolution, an algorithm
// negotiation surface, and the alg=none family of parser bugs, to sign five
// fields with one symmetric key that never rotates mid-request. The wire
// format is pinned from the other side by the workspace daemon's
// console-session.test.ts, which is the drift alarm across the two apps.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ACTIVE_WORKSPACE_COOKIE = 'cp_active_workspace';
export const ACTIVE_WORKSPACE_TTL_SECONDS = 8 * 60 * 60;

/**
 * The workspace daemon's authorization vocabulary, which is not this app's.
 *
 * SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW4. The daemon reads three scopes;
 * identity issues roles carrying a permission list. Mapping here rather than
 * signing the raw role keeps the daemon from having to learn a vocabulary it
 * does not own: a role added upstream would otherwise reach the daemon as an
 * unrecognized string, and whatever the daemon then did with it would be a
 * privilege decision nobody wrote down.
 */
export type WorkspaceSessionScope = 'owner' | 'collaborator' | 'viewer';

/**
 * The scope a permission set earns on the workspace daemon.
 *
 * `workspace.manage`, `members.manage`, and `keys.manage` are this app's names
 * for the operations the daemon gates behind owner: minting and revoking
 * tokens, deleting a workspace, upgrading the runtime. `content.write` is what
 * the chat register needs to run a turn. Everything else reads.
 */
export function workspaceSessionScope(
  permissions: readonly string[],
): WorkspaceSessionScope {
  const held = new Set(permissions);
  if (held.has('workspace.manage') || held.has('members.manage') || held.has('keys.manage')) {
    return 'owner';
  }
  return held.has('content.write') ? 'collaborator' : 'viewer';
}

export interface ActiveWorkspaceClaims {
  readonly version: 1;
  readonly subject: string;
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly tenant: string;
  readonly scopeRef: string;
  /**
   * What this subject may do on the workspace daemon.
   *
   * Added after the daemon shipped. Until it existed every console session
   * reached the daemon as a collaborator regardless of membership role, so a
   * read-only member was a writer and an admin could not reach the owner-only
   * routes at all. The daemon treats an absent scope as collaborator, which is
   * exactly the behaviour it had before, so a cookie minted before this change
   * keeps working instead of signing its holder out.
   */
  readonly scope: WorkspaceSessionScope;
  readonly expiresAt: number;
}

const SCOPES: ReadonlySet<string> = new Set<WorkspaceSessionScope>([
  'owner',
  'collaborator',
  'viewer',
]);

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
    || !SCOPES.has(input.scope)
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
    || (record.scope !== undefined && !SCOPES.has(record.scope as string))
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
    // Absent means a cookie minted before scopes were signed. Collaborator is
    // what the daemon granted every console session then, so reading it that
    // way changes nothing for an in-flight session. Reading it as owner would
    // hand every stale cookie the admin routes; reading it as viewer would
    // break writes for a member the console had already authorized.
    scope: (SCOPES.has(record.scope as string) ? record.scope : 'collaborator') as WorkspaceSessionScope,
    expiresAt: Number(record.expiresAt),
  });
}
