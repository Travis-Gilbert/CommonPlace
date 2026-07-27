// SOURCING: none. Shared fail-closed state for unscoped chat routes.

import Link from 'next/link';
import { ForkNotice, ForkPageFrame } from '@/components/fork/ForkPageFrame';

export function ChatUnavailable({
  settingsHref = null,
}: {
  readonly settingsHref?: string | null;
}) {
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
