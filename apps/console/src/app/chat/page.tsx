// SOURCING: none. Chat page route (CH1 / SPEC-THEOREM-CHAT-REGISTER-1.0 CR-006).
// Unscoped /chat renders the Theorem register over /api/chat/stream.

import { ChatUnavailable } from './chat-unavailable';
import { TheoremChatRegisterView } from '@/views/TheoremChatRegister';
import { redirectForFailedPrincipal } from '@/lib/server/principal-redirect';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function ChatIndexPage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    return redirectForFailedPrincipal(resolution, '/chat');
  }
  if (!resolution.principal.workspaceId || !resolution.principal.scopeRef) {
    return <ChatUnavailable settingsHref={null} />;
  }
  return (
    <TheoremChatRegisterView
      reason="Theorem ACP stream via /api/chat/stream. OpenWork is no longer the product /chat host."
      endpoint="/api/chat/stream"
    />
  );
}
