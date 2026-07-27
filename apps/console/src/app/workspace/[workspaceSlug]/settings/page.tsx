// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/WorkspaceSettings/index.jsx.

import { WorkspaceSettingsPage } from '@/components/fork/WorkspaceSettingsPage';

export default async function WorkspaceSettingsRoute({
  params,
}: {
  readonly params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug: workspaceRef } = await params;
  return <WorkspaceSettingsPage workspaceRef={workspaceRef} />;
}
