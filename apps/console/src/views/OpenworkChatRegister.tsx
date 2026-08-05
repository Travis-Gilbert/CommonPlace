'use client';

// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 CR-007.
// Deprecated product path. /chat now mounts TheoremChatRegisterView
// (theorem.chat). Kept only so historical imports fail loudly in review;
// do not wire new call sites.

import { TheoremChatRegisterView } from './TheoremChatRegister';

/** @deprecated Use TheoremChatRegisterView / theorem.chat. */
export function OpenworkChatRegister({
  reason = 'OpenWork chat is retired. Use the Theorem chat register.',
}: {
  readonly reason?: string;
}) {
  return <TheoremChatRegisterView reason={reason} />;
}
