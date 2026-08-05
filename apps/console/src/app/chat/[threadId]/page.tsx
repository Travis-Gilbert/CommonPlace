// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 CR-006. Thread URLs under
// /chat/* render the same Theorem register (thread id is UI context only until
// catalog persistence wires through).

import { redirect } from 'next/navigation';
import { TheoremChatRegisterView } from '@/views/TheoremChatRegister';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from '../chat-unavailable';

export default async function ChatThreadPage({
  params,
}: {
  readonly params: Promise<{ threadId: string }>;
}) {
  const [{ threadId }, resolution] = await Promise.all([
    params,
    resolveHarnessPrincipal(),
  ]);
  if (!resolution.ok) {
    redirect(`/login?callbackUrl=/chat/${encodeURIComponent(threadId)}`);
  }
  if (!resolution.principal.workspaceId || !resolution.principal.scopeRef) {
    return <ChatUnavailable settingsHref={null} />;
  }
  return (
    <TheoremChatRegisterView
      reason={`Thread ${threadId} on the Theorem chat register (theorem.chat).`}
      endpoint="/api/chat/stream"
    />
  );
}
