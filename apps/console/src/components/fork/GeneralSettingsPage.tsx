// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/GeneralSettings. Provider categories are cut.

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ForkPageFrame, ForkPanel } from './ForkPageFrame';

export function GeneralSettingsPage({
  workspaceId,
}: {
  readonly workspaceId?: string;
}) {
  const settings = [
    {
      title: 'Account and identity',
      description: 'Verified GitHub identity, tenant resolution, and object-seam credentials.',
      href: '/login',
    },
    {
      title: workspaceId ? 'Workspace settings' : 'Create or select a workspace',
      description: workspaceId
        ? 'Names, membership invitations, roles, documents, and consumer-boundary status.'
        : 'Choose the workspace that will own graph and chat scope.',
      href: workspaceId
        ? `/workspace/${encodeURIComponent(workspaceId)}/settings`
        : '/onboarding',
    },
    {
      title: 'Appearance',
      description: 'Register-backed theme family and light or dark preference.',
      href: '/appearance',
    },
    {
      title: 'Instance administration',
      description: 'Identity users, workspaces, and pending invitations for admitted administrators.',
      href: '/admin',
    },
  ] as const;

  return (
    <ForkPageFrame
      eyebrow="General settings"
      title="CommonPlace settings"
      description="These settings configure identity and presentation. Model routing stays with the Harness."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {settings.map((setting) => (
          <ForkPanel key={setting.title} title={setting.title} description={setting.description}>
            <Button asChild variant="outline"><Link href={setting.href}>Open</Link></Button>
          </ForkPanel>
        ))}
      </div>
    </ForkPageFrame>
  );
}
