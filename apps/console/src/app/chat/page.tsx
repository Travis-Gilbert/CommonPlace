// SOURCING: none. Chat page route (CH1). Not a view surface.

import Link from 'next/link';
import { ForkNotice, ForkPageFrame } from '@/components/fork/ForkPageFrame';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function ChatIndexPage() {
  const resolution = await resolveHarnessPrincipal();
  const settingsHref = resolution.ok && resolution.principal.workspaceId
    ? `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/settings`
    : null;
  return (
    <ForkPageFrame
      eyebrow="Chat"
      title="Chat unavailable"
      description="A scoped Harness runtime is required before a chat turn can run."
    >
      <ForkNotice tone="error">
        Chat is refusing the legacy unscoped ACP fallback.
      </ForkNotice>
      <p className="text-ij-ink-info">
        {settingsHref ? (
          <>
            Open <Link className="text-ij-link" href={settingsHref}>workspace settings</Link> to review the active graph scope.
          </>
        ) : (
          <>
            Select a workspace from <Link className="text-ij-link" href="/onboarding">onboarding</Link> before scoped chat is enabled.
          </>
        )}
      </p>
    </ForkPageFrame>
  );
}
