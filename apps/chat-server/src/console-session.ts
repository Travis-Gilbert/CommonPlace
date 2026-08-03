// SOURCING: none. Verify half of the console's own active-workspace cookie
// contract (apps/console/src/lib/server/active-workspace.ts).
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW4, named choice 4: Den sign-in is gone
// and the console session replaces it.
//
// The console signs a short-lived HttpOnly cookie naming the subject, the
// active workspace, and the tenant. When the chat register is served under the
// console's origin the browser attaches that cookie to every request here, so
// an already-authenticated console user is already authenticated to this
// daemon: no second sign-in, and no token for the browser to hold.
//
// Only the verify half lives here. This daemon never mints a session, so it
// never holds the signing key in a writing role, and a compromised workspace
// container cannot forge a console identity for a different tenant. The wire
// format is pinned by console-session.test.ts against a fixture produced by
// the console's own encoder; that test is the drift alarm, because the two
// halves are in different apps and nothing else would fail if they diverged.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ACTIVE_WORKSPACE_COOKIE = "cp_active_workspace";

/**
 * What a console session may do here.
 *
 * The same three values this daemon's token scopes use, because the console
 * derives them from its own role permissions before signing. Keeping the
 * mapping on that side means this file never has to know what a role named
 * "editor" is allowed to do, and a role added there cannot mint a privilege
 * here by arriving as a string this code guesses about.
 */
export type ConsoleSessionScope = "owner" | "collaborator" | "viewer";

const SCOPES: ReadonlySet<string> = new Set<ConsoleSessionScope>([
  "owner",
  "collaborator",
  "viewer",
]);

/**
 * The scope assumed when the console signed no scope at all.
 *
 * Collaborator is what this daemon granted every console session before the
 * field existed, so an in-flight cookie behaves exactly as it did. Owner would
 * hand every cookie minted before this change the token-minting and
 * workspace-deletion routes, which is the elevation the field exists to close.
 */
const SCOPE_WHEN_UNSIGNED: ConsoleSessionScope = "collaborator";

/** The claim set the console signs. Field names and limits are its contract. */
export type ConsoleSessionClaims = {
  readonly version: 1;
  readonly subject: string;
  readonly workspaceId: string;
  readonly workspaceSlug: string;
  readonly tenant: string;
  readonly scopeRef: string;
  readonly scope: ConsoleSessionScope;
  readonly expiresAt: number;
};

/** Minimum secret length. Matches the console; shorter is treated as absent. */
const MIN_SECRET_LENGTH = 32;

const FIELD_LIMITS = {
  subject: 160,
  workspaceId: 80,
  workspaceSlug: 80,
  tenant: 160,
  scopeRef: 255,
} as const;

function admittedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maxLength;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("commonplace-active-workspace-v1\0")
    .update(payload)
    .digest("base64url");
}

/**
 * The signing secret, or null when the console session is not configured.
 *
 * Returning null is the "not configured" state, not a failure: a workspace
 * running without a console in front of it authenticates with its own tokens
 * and never sees this cookie. Weak placeholder secrets read as absent so a
 * half-provisioned deployment fails closed rather than trusting a guessable
 * signature.
 */
export function resolveConsoleSessionSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const secret = environment.COMMONPLACE_ACTIVE_WORKSPACE_SECRET?.trim();
  if (!secret) return null;
  if (secret.length < MIN_SECRET_LENGTH || /^(?:change-me|example|test)$/i.test(secret)) {
    return null;
  }
  return secret;
}

/** Verify a signed cookie value. Returns null on any failure, never throws. */
export function decodeConsoleSessionClaims(
  value: string,
  secret: string,
  nowMs = Date.now(),
): ConsoleSessionClaims | null {
  const [payload, candidateSignature, extra] = value.split(".");
  if (!payload || !candidateSignature || extra || secret.length < MIN_SECRET_LENGTH) return null;

  const expected = signature(payload, secret);
  const left = Buffer.from(candidateSignature);
  const right = Buffer.from(expected);
  // Length is compared first because timingSafeEqual throws on a mismatch.
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;

  const record = claims as Record<string, unknown>;
  if (
    record.version !== 1
    || !admittedText(record.subject, FIELD_LIMITS.subject)
    || !admittedText(record.workspaceId, FIELD_LIMITS.workspaceId)
    || !admittedText(record.workspaceSlug, FIELD_LIMITS.workspaceSlug)
    || !admittedText(record.tenant, FIELD_LIMITS.tenant)
    || !admittedText(record.scopeRef, FIELD_LIMITS.scopeRef)
    // An unrecognized scope is a rejection, not a fallback. Falling back would
    // mean a typo, or a console signing a vocabulary this daemon has not
    // learned yet, silently became a collaborator.
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
    scope: (record.scope ?? SCOPE_WHEN_UNSIGNED) as ConsoleSessionScope,
    expiresAt: Number(record.expiresAt),
  });
}

/**
 * Read one cookie from a Cookie header.
 *
 * Values are split on the first "=" only: the cookie payload is
 * base64url + "." + base64url, neither of which contains "=", but a future
 * padded encoding would, and splitting on every "=" would silently truncate
 * the signature into a verification failure that looks like a bad secret.
 */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Claims for a request carrying a valid console session, else null.
 *
 * Null covers three different situations on purpose: no console configured, no
 * cookie sent, and a cookie that failed verification. Callers fall through to
 * token auth in all three, so distinguishing them here would only add a way to
 * probe which secret a deployment holds.
 */
export function readConsoleSession(
  request: Request,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  nowMs = Date.now(),
): ConsoleSessionClaims | null {
  const secret = resolveConsoleSessionSecret(environment);
  if (!secret) return null;
  const cookie = readCookie(request.headers.get("cookie"), ACTIVE_WORKSPACE_COOKIE);
  if (!cookie) return null;
  return decodeConsoleSessionClaims(cookie, secret, nowMs);
}
