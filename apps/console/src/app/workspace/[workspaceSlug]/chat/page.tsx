// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/WorkspaceChat/index.jsx. The page owns the route and
// composes the existing typed CommonPlace chat surface.

import Link from 'next/link';
import { ChatPage } from '@/components/chat/ChatPage';
import { ForkNotice, ForkPageFrame } from '@/components/fork/ForkPageFrame';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function WorkspaceChatRoute({
  params,
}: {
  readonly params: Promise<{ workspaceSlug: string }>;
}) {
  const [{ workspaceSlug }, resolution] = await Promise.all([
    params,
    resolveHarnessPrincipal(),
  ]);
  if (!resolution.ok) {
    return (
      <ForkPageFrame
        eyebrow="Workspace"
        title="Workspace unavailable"
        description="The active membership could not be verified."
      >
        <ForkNotice tone="error">
          Select the workspace again from its <Link className="text-ij-link" href={`/workspace/${encodeURIComponent(workspaceSlug)}/settings`}>settings page</Link>.
        </ForkNotice>
      </ForkPageFrame>
    );
  }
  if (
    resolution.principal.workspaceSlug !== workspaceSlug
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
          Open <Link className="text-ij-link" href={`/workspace/${encodeURIComponent(workspaceSlug)}/settings`}>workspace settings</Link> and select this workspace for chat.
        </ForkNotice>
      </ForkPageFrame>
    );
  }
  return <ChatPage tenant={resolution.principal.tenant} />;
}
