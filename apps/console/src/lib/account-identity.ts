// Porting by extraction: product apps import the shared identity policy
// through the CSS-free contract package and keep this compatibility path.
export {
  OWNER_GITHUB_LOGIN,
  githubHarnessIdentity,
  githubTenantSlug,
  isOwnerGithubLogin,
} from '@commonplace/theorem-acp/identity';
