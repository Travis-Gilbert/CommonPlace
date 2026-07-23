'use client';

// SOURCING: hand-roll. Placeholder mail connect and reader surfaces registered
// for the JMAP spoke handoff until the multi-step connect flow ships.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { BlockEmptyBody } from './blocks/BlockEmptyBody';

export function MailConnectView(_props: ViewRenderProps) {
  return (
    <div data-mail-connect className="flex h-full min-h-0 flex-col bg-ij-editor">
      <BlockEmptyBody
        title="Mail connect"
        detail="Connect a JMAP account, map folders, and confirm consent. The sync status surface will land with the mail spoke."
      />
    </div>
  );
}

export function MailReaderView(_props: ViewRenderProps) {
  return (
    <div data-mail-reader className="flex h-full min-h-0 flex-col bg-ij-editor">
      <BlockEmptyBody
        title="Mail reader"
        detail="Threads and entity chips appear here once a mail account is connected."
      />
    </div>
  );
}
