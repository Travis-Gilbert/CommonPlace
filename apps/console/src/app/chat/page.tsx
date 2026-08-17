// SOURCING: none. Chat page route (CH1 / SPEC-THEOREM-CHAT-REGISTER-1.0 CR-006).
// Unscoped /chat is a console Place: IntuiShell hosts theorem.chat, same as
// /records and /filing. The register is a pane, not the whole page.

import ConsoleSurfacePage from '@/lib/console-surface-page';
import { ChatUnavailable } from './chat-unavailable';
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
  return <ConsoleSurfacePage />;
}
