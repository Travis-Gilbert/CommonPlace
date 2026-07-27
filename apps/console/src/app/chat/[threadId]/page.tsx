// SOURCING: none. Thread-scoped chat page (CH1). Restores a real thread.

import { ChatPage } from '@/components/chat/ChatPage';

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId: routeThreadId } = await params;
  const threadId = decodeURIComponent(routeThreadId);
  return <ChatPage threadId={threadId} />;
}
