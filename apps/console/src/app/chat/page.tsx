// SOURCING: none. Chat index stays on /chat so OW4 middleware can reverse-proxy
// the workspace openwork door. Do not redirect into /workspace/*/chat — that
// path bypasses the proxy matcher and remounts the retired assistant-ui page.

import { redirect } from 'next/navigation';
import { OpenworkChatRegister } from '@/views/OpenworkChatRegister';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from './chat-unavailable';

export default async function ChatIndexPage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    redirect('/login?callbackUrl=/chat');
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
