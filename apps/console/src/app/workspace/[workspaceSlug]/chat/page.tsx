// SOURCING: none. Workspace-scoped chat URL collapses onto /chat so the OW4
// console-origin proxy owns the register body (SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL6).

import { redirect } from 'next/navigation';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function WorkspaceChatRoute({
  params,
}: {
  readonly params: Promise<{ workspaceSlug: string }>;
}) {
  const [{ workspaceSlug: workspaceRef }, resolution] = await Promise.all([
    params,
    resolveHarnessPrincipal(),
  ]);
  if (!resolution.ok) {
    redirect(
      `/login?callbackUrl=/workspace/${encodeURIComponent(workspaceRef)}/chat`,
    );
  }
  if (
    resolution.principal.workspaceId !== workspaceRef
    || !resolution.principal.workspaceId
    || !resolution.principal.scopeRef
  ) {
    redirect(`/workspace/${encodeURIComponent(workspaceRef)}/settings`);
  }
  redirect('/chat');
}
