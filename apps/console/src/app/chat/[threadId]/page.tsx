// SOURCING: none. Thread-scoped chat page (CH1). Restores a real thread.

import { ChatPage } from '@/components/chat/ChatPage';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from '../chat-unavailable';

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const [{ threadId: routeThreadId }, resolution] = await Promise.all([
    params,
    resolveHarnessPrincipal(),
  ]);
  if (
    !resolution.ok
    || !resolution.principal.workspaceId
    || !resolution.principal.scopeRef
  ) {
    return <ChatUnavailable />;
  }
  const threadId = decodeURIComponent(routeThreadId);
  return (
    <ChatPage
      threadId={threadId}
      tenant={resolution.principal.tenant}
    />
  );
}
