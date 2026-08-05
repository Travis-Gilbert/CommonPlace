'use client';

// SOURCING: @commonplace/theorem-chat-register. SPEC-THEOREM-CHAT-REGISTER-1.0
// CR-006 console mount. Replaces OpenworkChatRegister as the /chat body.
import { useMemo } from 'react';
import {
  TheoremChatRegister,
  createHttpStreamTransport,
} from '@commonplace/theorem-chat-register';

export function TheoremChatRegisterView({
  reason,
  endpoint = '/api/chat/stream',
}: {
  readonly reason?: string;
  readonly endpoint?: string;
}) {
  const transport = useMemo(
    () => createHttpStreamTransport({ endpoint }),
    [endpoint],
  );
  return (
    <TheoremChatRegister
      transport={transport}
      reason={reason}
      className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink"
      autoOpen
    />
  );
}
