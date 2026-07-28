// SOURCING: none. Chat page route (CH1). Unscoped /chat redirects into the
// active workspace chat once membership and scope are verified.

import { redirect } from 'next/navigation';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from './chat-unavailable';

export default async function ChatIndexPage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    redirect('/login?callbackUrl=/chat');
  }
  if (resolution.principal.workspaceId && resolution.principal.scopeRef) {
    redirect(
      `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/chat`,
    );
  }
  return <ChatUnavailable settingsHref={null} />;
}
