// SOURCING: none. Thread chat mounts only after an active graph scope exists.

import { redirect } from 'next/navigation';
import { ChatPage } from '@/components/chat/ChatPage';
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
    <ChatPage
      threadId={threadId}
      tenant={resolution.principal.tenant}
    />
  );
}
