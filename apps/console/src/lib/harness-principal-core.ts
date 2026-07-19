import type { Session } from 'next-auth';
import { githubTenantSlug } from '@/lib/account-identity';

export interface HarnessPrincipal {
  readonly tenant: string;
  readonly githubLogin: string;
  readonly harnessIdentity: string;
}

export function principalFromSession(session: Session | null): HarnessPrincipal | null {
  const githubLogin = session?.user?.githubLogin;
  const harnessIdentity = session?.user?.harnessIdentity;
  const tenant = githubTenantSlug(githubLogin);
  if (!tenant || typeof githubLogin !== 'string' || typeof harnessIdentity !== 'string') {
    return null;
  }
  return { tenant, githubLogin, harnessIdentity };
}

/** True when the principal matches the deployment's configured service
 *  tenant. Shared object/ACP credentials stay owner-scoped until per-tenant
 *  connectors exist. */
export function configuredServiceTenantMatches(
  principal: HarnessPrincipal,
  configuredTenant: unknown,
): boolean {
  const configured = typeof configuredTenant === 'string' ? configuredTenant.trim() : '';
  return Boolean(configured && configured.toLowerCase() === principal.tenant.toLowerCase());
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
