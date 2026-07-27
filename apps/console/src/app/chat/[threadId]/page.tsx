// SOURCING: none. Thread-scoped chat page (CH1). Restores a real thread.

import { ChatPage } from '@/components/chat/ChatPage';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const [{ threadId: routeThreadId }, principal] = await Promise.all([
    params,
    resolveHarnessPrincipal(),
  ]);
  const threadId = decodeURIComponent(routeThreadId);
  return (
    <ChatPage
      threadId={threadId}
      tenant={principal.ok ? principal.principal.tenant : null}
    />
  );
}
