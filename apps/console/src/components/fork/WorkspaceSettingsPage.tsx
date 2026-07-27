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
  uploadIdentityWorkspaceDocument,
} from '@/lib/identity/client';
import type { ApiKeyMeta } from '@/lib/identity/contracts';
import { useIdentitySession } from '@/lib/identity/use-identity-session';
import { useCopyToClipboard } from '@/lib/use-copy';
import { ForkField, ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';

function WorkspaceSettingsContent({ workspaceSlug }: { readonly workspaceSlug: string }) {
  const identity = useIdentitySession();
  const copy = useCopyToClipboard();
  const workspace = identity.state.status === 'ready'
    ? identity.state.session.workspaces.find((entry) => entry.slug === workspaceSlug)
    : null;
  const canManageWorkspace = workspace?.role.permissions.includes('workspace.manage') ?? false;
  const canManageMembers = workspace?.role.permissions.includes('members.manage') ?? false;
  const canManageKeys = workspace?.role.permissions.includes('keys.manage') ?? false;
  const canWriteContent = workspace?.role.permissions.includes('content.write') ?? false;
  const [name, setName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<readonly ApiKeyMeta[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    if (!workspace || !canManageKeys) return;
    let active = true;
    void listIdentityApiKeys(workspace.id)
      .then((records) => {
        if (active) setApiKeys(records);
      })
      .catch(() => {
        if (active) setNotice({ tone: 'error', message: 'API keys could not be loaded.' });
      });
    return () => {
      active = false;
    };
  }, [canManageKeys, workspace]);

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
          Sign in to continue. <Link className="text-ij-link" href={`/login?callbackUrl=/workspace/${encodeURIComponent(workspaceSlug)}/settings`}>Open login</Link>.
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
          This identity has no membership in workspace {workspaceSlug}.
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
                      `/workspace/${encodeURIComponent(workspace.slug)}/chat`,
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

          <ForkPanel
            title="Documents"
            description="The collector parses text, then the commonplace IngestPipeline classifies, embeds, files, and links it in this workspace scope."
          >
            {canWriteContent ? (
              <>
                <ForkField
                  label="Text or Markdown document"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  disabled={busy !== null || !documentFile}
                  onClick={() => {
                    if (!documentFile) return;
                    setBusy('document');
                    setNotice(null);
                    void uploadIdentityWorkspaceDocument(workspace.id, documentFile)
                      .then((receipt) => {
                        setDocumentFile(null);
                        setNotice({
                          tone: 'success',
                          message: `${receipt.receipts.length} parsed document${receipt.receipts.length === 1 ? '' : 's'} entered RustyRed through ${receipt.scopeRef}.`,
                        });
                      })
                      .catch((error) => fail(error, 'The document could not be ingested.'))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === 'document' ? 'Parsing and ingesting...' : 'Upload document'}
                </Button>
              </>
            ) : (
              <p className="text-ij-ink-info">Your role cannot add workspace content.</p>
            )}
          </ForkPanel>

          <ForkPanel
            title="API keys"
            description="Secrets are shown once. Stored records contain only a prefix and a hash."
          >
            {canManageKeys ? (
              <>
                <ForkField
                  label="Key name"
                  value={keyName}
                  placeholder="Embed widget"
                  maxLength={120}
                  onChange={(event) => setKeyName(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy('key');
                    setNotice(null);
                    void createIdentityApiKey(workspace.id, {
                      ...(keyName.trim() ? { name: keyName.trim() } : {}),
                    })
                      .then((created) => {
                        setRevealedKey(created.key);
                        setApiKeys((current) => [created.record, ...current]);
                        setNotice({ tone: 'success', message: 'API key created. Copy it before leaving this page.' });
                      })
                      .catch((error) => fail(error, 'The API key could not be created.'))
                      .finally(() => setBusy(null));
                  }}
                >
                  {busy === 'key' ? 'Creating key...' : 'Create API key'}
                </Button>
                {revealedKey ? (
                  <div className="grid gap-2 rounded-ij-arc border border-ij-control-border bg-ij-raised p-3">
                    <code className="break-all font-ij-mono">{revealedKey}</code>
                    <Button type="button" variant="outline" onClick={() => copy.copy(revealedKey)}>
                      {copy.state === 'copied' ? 'Copied' : copy.state === 'unavailable' ? 'Clipboard unavailable' : 'Copy API key'}
                    </Button>
                  </div>
                ) : null}
                <ul className="grid gap-2">
                  {apiKeys.map((apiKey) => (
                    <li key={apiKey.id} className="flex flex-wrap items-center gap-3 rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
                      <div className="min-w-0 flex-1">
                        <p style={{ fontWeight: 'var(--rec-weight-cap)' }}>{apiKey.name ?? 'Unnamed key'}</p>
                        <p className="font-ij-mono text-xs text-ij-ink-info">{apiKey.prefix}</p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => {
                          setBusy(apiKey.id);
                          void revokeIdentityApiKey(apiKey.id)
                            .then(() => setApiKeys((current) => current.filter((entry) => entry.id !== apiKey.id)))
                            .catch((error) => fail(error, 'The API key could not be revoked.'))
                            .finally(() => setBusy(null));
                        }}
                      >
                        {busy === apiKey.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-ij-ink-info">Your role cannot manage API keys.</p>
            )}
          </ForkPanel>
          {notice ? <ForkNotice tone={notice.tone}>{notice.message}</ForkNotice> : null}
        </div>
      )}
    </ForkPageFrame>
  );
}

export function WorkspaceSettingsPage({ workspaceSlug }: { readonly workspaceSlug: string }) {
  return (
    <SessionProvider>
      <WorkspaceSettingsContent workspaceSlug={workspaceSlug} />
    </SessionProvider>
  );
}
