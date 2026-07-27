// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/Invite/index.jsx.

import { InvitePage } from '@/components/fork/InvitePage';

export default async function InviteRoute({
  params,
}: {
  readonly params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <InvitePage code={code} />;
}
