// SOURCING: none. Root routes signed-out visitors to login and admitted
// workspaces to scoped chat.

import { redirect } from 'next/navigation';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function RootPage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    redirect('/login');
  }
  if (resolution.principal.workspaceId && resolution.principal.scopeRef) {
    redirect(
      `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/chat`,
    );
  }
  redirect('/onboarding');
}
