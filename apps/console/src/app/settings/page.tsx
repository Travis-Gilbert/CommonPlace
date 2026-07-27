// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/GeneralSettings/index.jsx.

import { GeneralSettingsPage } from '@/components/fork/GeneralSettingsPage';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';

export default async function SettingsPage() {
  const resolution = await resolveHarnessPrincipal();
  return (
    <GeneralSettingsPage
      workspaceSlug={
        resolution.ok ? resolution.principal.workspaceSlug : undefined
      }
    />
  );
}
