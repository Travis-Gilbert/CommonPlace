// SOURCING: none. Chat page route (CH1). Unscoped /chat redirects into the
// active workspace chat once membership and scope are verified.

import { ChatUnavailable } from './chat-unavailable';
import { OpenworkChatRegister } from '@/views/OpenworkChatRegister';
import { redirect } from 'next/navigation';
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
    <OpenworkChatRegister
      reason="CONSOLE_WORKSPACE_URL is unset on this deploy, so the openwork chat door was not proxied. Set the workspace URL and redeploy the console."
    />
  );
}
