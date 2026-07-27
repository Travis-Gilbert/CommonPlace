'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/Admin/{Users,Workspaces,Invitations}.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionProvider, useSession } from 'next-auth/react';
import { getIdentityAdminOverview, IdentityClientError } from '@/lib/identity/client';
import type { AdminOverview } from '@/lib/identity/contracts';
import { ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';

function adminCollectionTitle(
  label: string,
  count: number,
  truncated: boolean,
) {
  return `${label} (${count}${truncated ? ' shown, partial' : ''})`;
}

export function AdminOverviewPanels({
  overview,
}: {
  readonly overview: AdminOverview;
}) {
  const hasPartialCollection =
    overview.truncated.users
    || overview.truncated.workspaces
    || overview.truncated.pendingInvites;

  return (
    <div className="grid gap-4">
      {hasPartialCollection ? (
        <ForkNotice>
          This is a bounded result. Sections marked partial have additional
          records that are not shown.
        </ForkNotice>
      ) : null}
      <ForkPanel
        title={adminCollectionTitle(
          'Users',
          overview.users.length,
          overview.truncated.users,
        )}
      >
        <ul className="grid gap-2">
          {overview.users.map((user) => (
            <li key={user.id} className="rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
              <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>{user.displayName ?? user.username}</p>
              <p className="font-ij-mono text-xs text-ij-ink-info">{user.username}</p>
            </li>
          ))}
        </ul>
      </ForkPanel>
      <ForkPanel
        title={adminCollectionTitle(
          'Workspaces',
          overview.workspaces.length,
          overview.truncated.workspaces,
        )}
      >
        <ul className="grid gap-2">
          {overview.workspaces.map((workspace) => (
            <li key={workspace.id} className="rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
              <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>{workspace.name}</p>
              <p className="font-ij-mono text-xs text-ij-ink-info">
                {workspace.tenant} / {workspace.scopeRef}
              </p>
            </li>
          ))}
        </ul>
      </ForkPanel>
      <ForkPanel
        title={adminCollectionTitle(
          'Pending invitations',
          overview.pendingInvites.length,
          overview.truncated.pendingInvites,
        )}
      >
        <ul className="grid gap-2">
          {overview.pendingInvites.map((invite) => (
            <li key={invite.id} className="rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
              {invite.workspace.name}: {invite.role.name}
            </li>
          ))}
        </ul>
      </ForkPanel>
    </div>
  );
}

function AdminContent() {
  const session = useSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status !== 'authenticated') return;
    let active = true;
    void getIdentityAdminOverview()
      .then((result) => {
        if (active) setOverview(result);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof IdentityClientError
              ? caught.message
              : 'Administration data could not be loaded',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [session.status]);

  return (
    <ForkPageFrame
      eyebrow="Administration"
      title="Instance identity"
      description="This page can inspect identity records only. Documents, chats, memory, graph, and Harness receipts are not stored in the administration database."
    >
      {session.status === 'unauthenticated' ? (
        <ForkNotice tone="error">
          Sign in to continue. <Link className="text-ij-link" href="/login?callbackUrl=/admin">Open login</Link>.
        </ForkNotice>
      ) : error ? (
        <ForkNotice tone="error">{error}</ForkNotice>
      ) : !overview ? (
        <p aria-live="polite" className="text-ij-ink-info">Loading instance identity...</p>
      ) : (
        <AdminOverviewPanels overview={overview} />
      )}
    </ForkPageFrame>
  );
}

export function AdminPage() {
  return (
    <SessionProvider>
      <AdminContent />
    </SessionProvider>
  );
}
