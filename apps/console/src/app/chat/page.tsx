// SOURCING: none. Chat page route (CH1). Not a view surface.

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from './chat-unavailable';

export default async function ChatIndexPage() {
  const resolution = await resolveHarnessPrincipal();
  const settingsHref = resolution.ok && resolution.principal.workspaceId
    ? `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/settings`
    : null;
  return <ChatUnavailable settingsHref={settingsHref} />;
}
