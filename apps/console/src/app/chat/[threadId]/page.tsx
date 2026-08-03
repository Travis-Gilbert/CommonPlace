// SOURCING: none. Thread URLs under /chat/* are owned by the OW4 workspace
// proxy when CONSOLE_WORKSPACE_URL is set. This page is the fallback body for
// deploys where the proxy is absent.

import { redirect } from 'next/navigation';
import { OpenworkChatRegister } from '@/views/OpenworkChatRegister';
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
    <OpenworkChatRegister
      reason={`Thread ${threadId} would open on the openwork door once CONSOLE_WORKSPACE_URL is set and the console proxies /chat.`}
    />
  );
}
