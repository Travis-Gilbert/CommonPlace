// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/WorkspaceChat/index.jsx. The page owns the route and
// mounts ChatPage only when the active membership matches this workspace.

import Link from 'next/link';
import { ChatPage } from '@/components/chat/ChatPage';
import { ForkNotice, ForkPageFrame } from '@/components/fork/ForkPageFrame';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { redirectForFailedPrincipal } from '@/lib/server/principal-redirect';

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
    return redirectForFailedPrincipal(
      resolution,
      `/workspace/${encodeURIComponent(workspaceRef)}/chat`,
    );
  }
  if (
    resolution.principal.workspaceId !== workspaceRef
    || !resolution.principal.workspaceId
    || !resolution.principal.scopeRef
  ) {
    return (
      <ForkPageFrame
        eyebrow="Workspace"
        title="Select this workspace"
        description="Graph access follows an active, server-verified workspace membership."
      >
        <ForkNotice>
          Open <Link className="text-ij-link" href={`/workspace/${encodeURIComponent(workspaceRef)}/settings`}>workspace settings</Link> and select this workspace for chat.
        </ForkNotice>
      </ForkPageFrame>
    );
  }
  return <ChatPage tenant={resolution.principal.tenant} />;
}
