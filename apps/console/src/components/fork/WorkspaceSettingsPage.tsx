'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/WorkspaceSettings/{GeneralAppearance,Members}.
// Provider and vector settings are cut in favor of the Harness and RustyRed.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  createIdentityInvite,
  IdentityClientError,
  selectIdentityWorkspace,
  updateIdentityWorkspace,
} from '@/lib/identity/client';
import { useIdentitySession } from '@/lib/identity/use-identity-session';
import { resolveIdentityWorkspaceRoute } from '@/lib/identity/workspace-route';
import { useCopyToClipboard } from '@/lib/use-copy';
import { ForkField, ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';

export function WorkspaceDocumentsPanel({
  canWriteContent,
}: {
  readonly canWriteContent: boolean;
}) {
  return (
    <ForkPanel
      title="Documents"
      description="Document ingestion stays closed until the CommonPlace API enforces the admitted graph scope."
    >
      {canWriteContent ? (
        <ForkNotice tone="error">
          Document upload is disabled until the consumer API enforces the
          admitted tenant, workspace, and scope reference.
        </ForkNotice>
      ) : (
        <p className="text-ij-ink-info">Your role cannot add workspace content.</p>
      )}
    </ForkPanel>
  );
}

function WorkspaceSettingsContent({ workspaceRef }: { readonly workspaceRef: string }) {
  const identity = useIdentitySession();
  const copy = useCopyToClipboard();
  const routeResolution = identity.state.status === 'ready'
    ? resolveIdentityWorkspaceRoute(identity.state.session.workspaces, workspaceRef)
    : null;
  const workspace = routeResolution?.kind === 'resolved'
    ? routeResolution.workspace
    : null;
  const canManageWorkspace = workspace?.role.permissions.includes('workspace.manage') ?? false;
  const canManageMembers = workspace?.role.permissions.includes('members.manage') ?? false;
  const canWriteContent = workspace?.role.permissions.includes('content.write') ?? false;
  const [name, setName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  const scopeSummary = useMemo(
    () => workspace ? `${workspace.tenant} / ${workspace.scopeRef}` : null,
    [workspace],
  );

  const fail = (error: unknown, fallback: string) => {
    setNotice({
      tone: 'error',
      message: error instanceof IdentityClientError ? error.message : fallback,
    });
  };

  if (identity.state.status === 'signed-out') {
    return (
      <ForkPageFrame eyebrow="Workspace" title="Workspace settings" description="Sign in to resolve this workspace.">
        <ForkNotice tone="error">
          Sign in to continue. <Link className="text-ij-link" href={`/login?callbackUrl=/workspace/${encodeURIComponent(workspaceRef)}/settings`}>Open login</Link>.
        </ForkNotice>
      </ForkPageFrame>
    );
  }

  return (
    <ForkPageFrame
      eyebrow="Workspace"
      title={workspace?.name ?? 'Workspace settings'}
      description="Identity settings live in PostgreSQL. Content settings and provider selectors do not appear on this page."
    >
      {identity.state.status === 'error' ? (
        <ForkNotice tone="error">{identity.state.message}</ForkNotice>
      ) : identity.state.status !== 'ready' ? (
        <p aria-live="polite" className="text-ij-ink-info">Resolving workspace membership...</p>
      ) : !workspace ? (
        <ForkNotice tone="error">
          {routeResolution?.kind === 'ambiguous'
            ? 'This slug matches workspaces in more than one tenant. Open the workspace from onboarding to use its unambiguous ID.'
            : `This identity has no membership in workspace ${workspaceRef}.`}
        </ForkNotice>
      ) : (
        <div className="grid gap-4">
          <ForkPanel title="General" description={scopeSummary ?? undefined}>
            <ForkField
              label="Workspace name"
              value={name ?? workspace.name}
              disabled={!canManageWorkspace}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="button"
              disabled={!canManageWorkspace || busy !== null || !(name ?? workspace.name).trim()}
              onClick={() => {
                setBusy('workspace');
                setNotice(null);
                void updateIdentityWorkspace(workspace.id, { name: name ?? workspace.name })
                  .then(async () => {
                    await identity.refresh();
                    setName(null);
                    setNotice({ tone: 'success', message: 'Workspace name updated.' });
                  })
                  .catch((error) => fail(error, 'Workspace settings could not be saved.'))
                  .finally(() => setBusy(null));
              }}
            >
              {busy === 'workspace' ? 'Saving...' : 'Save workspace'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => {
                setBusy('select');
                setNotice(null);
                void selectIdentityWorkspace(workspace.id)
                  .then(() => {
                    window.location.assign(
                      `/workspace/${encodeURIComponent(workspace.id)}/chat`,
                    );
                  })
                  .catch((error) => {
                    fail(error, 'The workspace could not be selected.');
                    setBusy(null);
                  });
              }}
            >
              {busy === 'select' ? 'Selecting workspace...' : 'Use for chat and graph'}
            </Button>
          </ForkPanel>

          <ForkPanel
            title="Members and invitations"
            description="An invitation grants the Member role in this workspace only."
          >
            {canManageMembers ? (
              <>
                <ForkField
                  label="Invite email"
                  type="email"
                  value={inviteEmail}
                  placeholder="person@example.com"
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy('invite');
                    setNotice(null);
                    void createIdentityInvite(workspace.id, {
                      ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}),
                    })
                      .then((created) => {
                        const url = `${window.location.origin}/invite/${encodeURIComponent(created.code)}`;
                        setInviteUrl(url);
                        setNotice({ tone: 'success', message: 'Invitation created. The claim URL is shown once.' });
                      })
                      .catch((error) => fail(error, 'The invitation could not be created.'))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === 'invite' ? 'Creating invitation...' : 'Create invitation'}
                </Button>
                {inviteUrl ? (
                  <div className="grid gap-2 rounded-ij-arc border border-ij-control-border bg-ij-raised p-3">
                    <code className="break-all font-ij-mono">{inviteUrl}</code>
                    <Button type="button" variant="outline" onClick={() => copy.copy(inviteUrl)}>
                      {copy.state === 'copied' ? 'Copied' : copy.state === 'unavailable' ? 'Clipboard unavailable' : 'Copy invitation URL'}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-ij-ink-info">Your role cannot manage members.</p>
            )}
          </ForkPanel>

          <WorkspaceDocumentsPanel canWriteContent={canWriteContent} />

          <ForkPanel
            title="API keys"
            description="Issuance remains disabled until a public consumer can enforce the admitted tenant and workspace scope."
          >
            <ForkNotice tone="error">
              No secret will be created here while the CommonPlace API still
              relies on an independent service-key registry.
            </ForkNotice>
          </ForkPanel>
          {notice ? <ForkNotice tone={notice.tone}>{notice.message}</ForkNotice> : null}
        </div>
      )}
    </ForkPageFrame>
  );
}

export function WorkspaceSettingsPage({ workspaceRef }: { readonly workspaceRef: string }) {
  return (
    <SessionProvider>
      <WorkspaceSettingsContent workspaceRef={workspaceRef} />
    </SessionProvider>
  );
}
