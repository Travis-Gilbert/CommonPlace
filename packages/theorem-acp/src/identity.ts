/** Pure identity policy shared by CommonPlace product surfaces. */

export const OWNER_GITHUB_LOGIN = 'Travis-Gilbert';

export function isOwnerGithubLogin(login: unknown): boolean {
  return typeof login === 'string' && login.toLowerCase() === OWNER_GITHUB_LOGIN.toLowerCase();
}

export function githubHarnessIdentity(providerAccountId: unknown): string | undefined {
  if (typeof providerAccountId !== 'string' || providerAccountId.trim() === '') return undefined;
  return `github:${providerAccountId.trim()}`;
}

/**
 * GitHub usernames already satisfy the Harness tenant alphabet. Normalize by
 * the same case-preserving rule as hosted OAuth and refuse the reserved
 * commons name instead of inventing a product default.
 */
const TENANT_SLUG_CHAR = /[A-Za-z0-9]/;

export function githubTenantSlug(login: unknown): string | undefined {
  if (typeof login !== 'string') return undefined;
  let slug = '';
  let previousWasSeparator = true;
  for (const character of login.trim()) {
    if (TENANT_SLUG_CHAR.test(character)) {
      slug += character;
      previousWasSeparator = false;
    } else if (!previousWasSeparator) {
      slug += '-';
      previousWasSeparator = true;
    }
  }
  slug = slug.replace(/^-+|-+$/g, '');
  if (!slug || slug.toLowerCase() === 'default') return undefined;
  return slug;
}
