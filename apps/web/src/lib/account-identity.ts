export const OWNER_GITHUB_LOGIN = 'Travis-Gilbert';

export function isOwnerGithubLogin(login: unknown): boolean {
  return typeof login === 'string' && login.toLowerCase() === OWNER_GITHUB_LOGIN.toLowerCase();
}

export function githubHarnessIdentity(providerAccountId: unknown): string | undefined {
  if (typeof providerAccountId !== 'string' || providerAccountId.trim() === '') return undefined;
  return `github:${providerAccountId.trim()}`;
}
