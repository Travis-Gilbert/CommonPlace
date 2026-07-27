// SOURCING: none. Thread chat refuses the legacy unscoped runtime.

import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from '../chat-unavailable';

export default async function ChatThreadPage() {
  const resolution = await resolveHarnessPrincipal();
  const settingsHref = resolution.ok && resolution.principal.workspaceId
    ? `/workspace/${encodeURIComponent(resolution.principal.workspaceId)}/settings`
    : null;
  return <ChatUnavailable settingsHref={settingsHref} />;
}
