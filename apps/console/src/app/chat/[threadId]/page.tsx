// SOURCING: none. SPEC-THEOREM-CHAT-REGISTER-1.0 CR-006. Thread URLs under
// /chat/* open the same console Place as /chat. Thread id is UI context for
// the shell companions until catalog persistence wires through.

import ConsoleSurfacePage from '@/lib/console-surface-page';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { ChatUnavailable } from '../chat-unavailable';
import { redirect } from 'next/navigation';

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
  return <ConsoleSurfacePage />;
}
