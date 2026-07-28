// SOURCING: none. Shared fail-closed state when chat cannot yet run scoped.

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
      title="Select a workspace"
      description="Chat needs an active workspace before a turn can run."
    >
      <ForkNotice>
        Sign in and select a workspace so chat can use your admitted graph scope.
      </ForkNotice>
      <p className="text-ij-ink-info">
        {settingsHref ? (
          <>
            Open <Link className="text-ij-link" href={settingsHref}>workspace settings</Link> to review the active graph scope.
          </>
        ) : (
          <>
            Continue from <Link className="text-ij-link" href="/login">login</Link>
            {' '}or <Link className="text-ij-link" href="/onboarding">onboarding</Link>.
          </>
        )}
      </p>
    </ForkPageFrame>
  );
}
