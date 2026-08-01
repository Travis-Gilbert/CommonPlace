'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/WorkspaceSettings/{GeneralAppearance,Members}.
// Provider and vector settings are cut in favor of the Harness and RustyRed.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  createIdentityApiKey,
  createIdentityInvite,
  IdentityClientError,
  listIdentityApiKeys,
  revokeIdentityApiKey,
  selectIdentityWorkspace,
  updateIdentityWorkspace,
} from '@/lib/identity/client';
import type { ApiKeyMeta } from '@/lib/identity/contracts';
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

export function WorkspaceApiKeysPanel({
  workspaceId,
  canManageKeys,
}: {
  readonly workspaceId: string;
  readonly canManageKeys: boolean;
}) {
  const copy = useCopyToClipboard();
  const [keys, setKeys] = useState<readonly ApiKeyMeta[]>([]);
  const [name, setName] = useState('Theorem agent and models');
  const [secret, setSecret] = useState<string | null>(null);
  const [secretKeyId, setSecretKeyId] = useState<string | null>(null);
  const [pendingRevocationId, setPendingRevocationId] = useState<string | null>(null);
  const [revocationCacheSeconds, setRevocationCacheSeconds] = useState(60);
  const [status, setStatus] = useState<'idle' | 'loading' | 'creating' | 'revoking'>(
    canManageKeys ? 'loading' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageKeys) return;
    let active = true;
    void listIdentityApiKeys(workspaceId)
      .then((listedKeys) => {
        if (active) setKeys(listedKeys);
      })
      .catch((caught) => {
        if (!active) return;
        setError(
          caught instanceof IdentityClientError
            ? caught.message
            : 'API keys could not be loaded.',
        );
      })
      .finally(() => {
        if (active) setStatus('idle');
      });
    return () => {
      active = false;
    };
  }, [canManageKeys, workspaceId]);

  return (
    <ForkPanel
      title="API keys"
      description={`One key can use hosted models and bind the agent. Revocation reaches both lanes within ${revocationCacheSeconds} seconds.`}
    >
      {!canManageKeys ? (
        <p className="text-ij-ink-info">Your role cannot manage API keys.</p>
      ) : (
        <>
          <ForkField
            label="Key name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="button"
            disabled={status !== 'idle' || !name.trim()}
            onClick={() => {
              setStatus('creating');
              setError(null);
              setSecret(null);
              setSecretKeyId(null);
              void createIdentityApiKey(workspaceId, { name: name.trim() })
                .then((created) => {
                  setSecret(created.key);
                  setSecretKeyId(created.record.id);
                  setRevocationCacheSeconds(created.revocationCacheSeconds);
                  setKeys((current) => [created.record, ...current]);
                })
                .catch((caught) => {
                  setError(
                    caught instanceof IdentityClientError
                      ? caught.message
                      : 'The API key could not be created.',
                  );
                })
                .finally(() => setStatus('idle'));
            }}
          >
            {status === 'creating' ? 'Creating key...' : 'Create key'}
          </Button>

          {secret ? (
            <div className="grid gap-2 rounded-ij-arc border border-ij-control-border bg-ij-raised p-3">
              <p className="text-ij-ink-info">
                Copy this key now. CommonPlace will not show the secret again.
              </p>
              <code className="break-all font-ij-mono">{secret}</code>
              <Button type="button" variant="outline" onClick={() => copy.copy(secret)}>
                {copy.state === 'copied'
                  ? 'Copied'
                  : copy.state === 'unavailable'
                    ? 'Clipboard unavailable'
                    : 'Copy key'}
              </Button>
            </div>
          ) : null}

          {status === 'loading' ? (
            <p aria-live="polite" className="text-ij-ink-info">Loading keys...</p>
          ) : null}
          {error ? <ForkNotice tone="error">{error}</ForkNotice> : null}

          {keys.length > 0 ? (
            <ul className="grid gap-2">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="grid gap-2 rounded-ij-arc border border-ij-control-border bg-ij-raised p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                        {key.name ?? 'Theorem key'}
                      </p>
                      <p className="font-ij-mono text-ij-ink-info">{key.prefix}</p>
                    </div>
                    {pendingRevocationId === key.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={status !== 'idle'}
                          onClick={() => setPendingRevocationId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={status !== 'idle'}
                          onClick={() => {
                            setStatus('revoking');
                            setError(null);
                            void revokeIdentityApiKey(workspaceId, key.id)
                              .then(() => {
                                setKeys((current) =>
                                  current.filter((item) => item.id !== key.id),
                                );
                                setPendingRevocationId(null);
                                if (secretKeyId === key.id) {
                                  setSecret(null);
                                  setSecretKeyId(null);
                                }
                              })
                              .catch((caught) => {
                                setError(
                                  caught instanceof IdentityClientError
                                    ? caught.message
                                    : 'The API key could not be revoked.',
                                );
                              })
                              .finally(() => setStatus('idle'));
                          }}
                        >
                          Confirm revoke
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={status !== 'idle'}
                        onClick={() => setPendingRevocationId(key.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                  <p className="text-ij-ink-info">
                    Scopes: {key.scopes.join(', ')}
                  </p>
                  <p className="text-ij-ink-info">
                    Last used: {key.lastUsedAt ?? 'never'}
                  </p>
                </li>
              ))}
            </ul>
          ) : status === 'idle' && !error ? (
            <p className="text-ij-ink-info">No active API keys.</p>
          ) : null}
        </>
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
  const canManageKeys = workspace?.role.permissions.includes('keys.manage') ?? false;
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
      description="Identity and membership settings for this workspace. Provider selectors do not appear on this page."
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

          <WorkspaceApiKeysPanel
            workspaceId={workspace.id}
            canManageKeys={canManageKeys}
          />
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
