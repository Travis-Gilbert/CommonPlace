import type { Session } from 'next-auth';
import { githubTenantSlug } from '@/lib/account-identity';

export interface HarnessPrincipal {
  readonly tenant: string;
  readonly githubLogin: string;
  readonly harnessIdentity: string;
  readonly controlIdentity?: ControlResolvedIdentity;
  readonly workspaceId?: string;
  readonly workspaceSlug?: string;
  readonly scopeRef?: string;
}

export interface ControlResolvedIdentity {
  readonly principal: {
    readonly id: string;
    readonly kind: 'human' | 'agent' | 'service';
    readonly display_name: string;
  };
  readonly kind: 'github' | 'session' | 'api_key' | 'signed_request' | 'store_bearer';
  readonly tenant: {
    readonly id: string;
    readonly slug: string;
  };
  readonly scopes: readonly string[];
}

export function principalFromSession(
  session: Session | null,
  controlIdentity?: ControlResolvedIdentity,
): HarnessPrincipal | null {
  const githubLogin = session?.user?.githubLogin;
  const harnessIdentity = session?.user?.harnessIdentity;
  const tenant = controlIdentity?.tenant.slug.trim();
  if (
    !tenant
    || !controlIdentity?.principal.id
    || controlIdentity.kind !== 'github'
    || typeof githubLogin !== 'string'
    || typeof harnessIdentity !== 'string'
  ) {
    return null;
  }
  return { tenant, githubLogin, harnessIdentity, controlIdentity };
}

/** Compatibility principal for the pre-login Console. It is admitted only
 * from an explicit non-default deployment tenant, and disappears as soon as
 * GitHub auth is configured. */
export function legacyServicePrincipal(
  configuredTenant: unknown,
  githubAuthConfigured: boolean,
): HarnessPrincipal | null {
  if (githubAuthConfigured) return null;
  const tenant = githubTenantSlug(configuredTenant);
  if (!tenant) return null;
  return {
    tenant,
    githubLogin: tenant,
    harnessIdentity: `service:commonplace-console:${tenant}`,
  };
}

export function principalScopeHeaders(principal: HarnessPrincipal): Record<string, string> {
  return {
    'x-theorem-tenant': principal.tenant,
    'x-tenant-id': principal.tenant,
    'x-theorem-principal': principal.harnessIdentity,
    ...(principal.workspaceId
      ? { 'x-commonplace-workspace': principal.workspaceId }
      : {}),
    ...(principal.scopeRef
      ? { 'x-commonplace-scope-ref': principal.scopeRef }
      : {}),
  };
}

/**
 * True when the principal carries an admitted workspace/ScopeRef claim.
 * Object-seam auth still keys off the credential tenant; these claims travel
 * as headers for consumers that enforce them. Do not use this as a Console
 * hard-refuse. That blocked every onboarded workspace behind a false
 * "data API unreachable" state.
 */
export function principalRequiresScopedObjectConsumer(
  principal: HarnessPrincipal,
): boolean {
  return Boolean(principal.workspaceId || principal.scopeRef);
}

/** Keep tenant-scoped run ledger entries. Entries without a nested scope are
 *  admitted when the upstream request already filtered by tenant. */
export function filterRunsForTenant(runs: unknown[], tenant: string): unknown[] {
  return runs.filter((candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const scope = (candidate as { scope?: unknown }).scope;
    if (!scope || typeof scope !== 'object') return true;
    const record = scope as Record<string, unknown>;
    return record.tenant === tenant || record.tenant_slug === tenant;
  });
}
