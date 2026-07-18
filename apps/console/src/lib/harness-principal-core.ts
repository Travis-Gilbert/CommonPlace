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
