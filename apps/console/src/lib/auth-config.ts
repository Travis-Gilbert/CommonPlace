export interface GithubAuthEnvironment {
  readonly AUTH_GITHUB_ID?: string;
  readonly AUTH_GITHUB_SECRET?: string;
}

export interface GithubAuthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/** Both halves are required. A half-configured provider must never render a
 * live control that sends the user to GitHub with an invalid client id. */
export function githubAuthCredentials(
  environment: GithubAuthEnvironment,
): GithubAuthCredentials | null {
  const clientId = environment.AUTH_GITHUB_ID?.trim();
  const clientSecret = environment.AUTH_GITHUB_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
