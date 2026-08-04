// SOURCING: none. Canonical App Router segment for the IDE register.
// When the Railway edge proxy has CONSOLE_IDE_WORKSPACE_URL (or derives it from
// CONSOLE_WORKSPACE_URL:8080), /IDE is reverse-proxied to code-server with
// WebSocket upgrades and never reaches this page. This body is the unconfigured
// fallback and the doctor stamp.

import { redirect } from 'next/navigation';
import { IdeRegister } from '@/views/IdeRegister';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function IdePage() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) {
    redirect('/login?callbackUrl=/IDE');
  }
  if (!resolution.principal.workspaceId || !resolution.principal.scopeRef) {
    return (
      <IdeRegister reason="Select an active workspace before opening the IDE door." />
    );
  }
  return (
    <IdeRegister
      reason="CONSOLE_IDE_WORKSPACE_URL is unset (and could not be derived from CONSOLE_WORKSPACE_URL) on this deploy, so the code-server IDE door was not proxied. Set the workspace IDE URL and redeploy the console with the edge proxy."
    />
  );
}
