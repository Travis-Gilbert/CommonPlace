// SOURCING: none. Chat page route (CH1). Not a view surface.

import { ChatPage } from '@/components/chat/ChatPage';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function ChatIndexPage() {
  const principal = await resolveHarnessPrincipal();
  return <ChatPage tenant={principal.ok ? principal.principal.tenant : null} />;
}
