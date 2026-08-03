// SOURCING: none. Root routes signed-out visitors to login and admitted
// workspaces to scoped chat.

import { redirect } from 'next/navigation';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { redirectForFailedPrincipal } from '@/lib/server/principal-redirect';

export default async function RootPage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return redirectForFailedPrincipal(resolution, '/');
  }
  if (resolution.principal.workspaceId && resolution.principal.scopeRef) {
    redirect(
      `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/chat`,
    );
  }
  redirect('/onboarding');
}
