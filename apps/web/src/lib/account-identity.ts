// Porting by extraction: legacy callers retain this path while the identity
// policy lives in the CSS-free contract package shared with apps/console.
export {
  OWNER_GITHUB_LOGIN,
  githubHarnessIdentity,
  githubTenantSlug,
  isOwnerGithubLogin,
} from '@commonplace/theorem-acp/identity';
