'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/OnboardingFlow/Steps/{Home,DataHandling,UserSetup}.
// Provider configuration steps are cut. The Harness owns execution.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  createIdentityWorkspace,
  IdentityClientError,
  selectIdentityWorkspace,
} from '@/lib/identity/client';
import type { IdentityWorkspace } from '@/lib/identity/contracts';
import { useIdentitySession } from '@/lib/identity/use-identity-session';
import { ForkField, ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';

export function workspaceSlugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function OnboardingContent() {
  const identity = useIdentitySession();
  const [name, setName] = useState('My workspace');
  const suggestedSlug = useMemo(() => workspaceSlugFromName(name), [name]);
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<IdentityWorkspace | null>(null);

  const openWorkspace = async (workspace: IdentityWorkspace) => {
    setBusy(true);
    setError(null);
    try {
      await selectIdentityWorkspace(workspace.id);
      window.location.assign(`/workspace/${encodeURIComponent(workspace.slug)}/chat`);
    } catch (caught) {
      setError(
        caught instanceof IdentityClientError
          ? caught.message
          : 'The workspace could not be selected',
      );
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const workspace = await createIdentityWorkspace({
        name,
        slug: slug || suggestedSlug,
      });
      await selectIdentityWorkspace(workspace.id);
      setCreated(workspace);
      await identity.refresh();
    } catch (caught) {
      setError(
        caught instanceof IdentityClientError
          ? caught.message
          : 'The workspace could not be created',
      );
    } finally {
      setBusy(false);
    }
  };

  const aside = (
    <ol className="grid gap-3">
      {[
        ['1', 'Verified person'],
        ['2', 'Identity workspace'],
        ['3', 'Graph scope'],
      ].map(([number, label]) => (
        <li key={number} className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-ij-arc border border-ij-control-border bg-ij-raised">
            {number}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <ForkPageFrame
      eyebrow="Onboarding"
      title="Create your first workspace"
      description="A workspace binds your verified tenant to one admitted RustyRed scope. Model, embedding, vector, and audio provider choices are intentionally absent."
      aside={aside}
    >
      {identity.state.status === 'signed-out' ? (
        <ForkNotice tone="error">
          Sign in before creating a workspace. <Link className="text-ij-link" href="/login?callbackUrl=/onboarding">Open login</Link>.
        </ForkNotice>
      ) : identity.state.status === 'error' ? (
        <ForkNotice tone="error">{identity.state.message}</ForkNotice>
      ) : identity.state.status === 'ready' && identity.state.session.onboardingComplete ? (
        <ForkPanel title="Onboarding complete">
          <p className="text-ij-ink-info">
            Your identity already has {identity.state.session.workspaces.length} admitted workspace
            {identity.state.session.workspaces.length === 1 ? '' : 's'}.
          </p>
          <div className="flex flex-wrap gap-2">
            {identity.state.session.workspaces.map((workspace) => (
              <Button
                key={workspace.id}
                type="button"
                disabled={busy}
                onClick={() => void openWorkspace(workspace)}
              >
                Open {workspace.name}
              </Button>
            ))}
          </div>
          {error ? <ForkNotice tone="error">{error}</ForkNotice> : null}
        </ForkPanel>
      ) : (
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <ForkPanel
            title="Workspace identity"
            description="Names can change. The generated graph scope remains bound to the workspace UUID."
          >
            <ForkField
              label="Workspace name"
              name="name"
              value={name}
              maxLength={160}
              required
              onChange={(event) => setName(event.target.value)}
            />
            <ForkField
              label="Workspace slug"
              name="slug"
              value={slug}
              placeholder={suggestedSlug || 'my-workspace'}
              maxLength={64}
              pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
              hint="Lowercase letters, numbers, and interior hyphens."
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
          </ForkPanel>
          <ForkPanel title="Data boundary">
            <p className="text-ij-ink-info">
              PostgreSQL stores this workspace&apos;s identity record and membership. Documents, chat,
              memory, graph, plans, and receipts stay in RustyRed.
            </p>
          </ForkPanel>
          {error ? <ForkNotice tone="error">{error}</ForkNotice> : null}
          {created ? (
            <ForkNotice tone="success">{created.name} is ready and selected.</ForkNotice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !name.trim() || !(slug || suggestedSlug)}>
              {busy ? 'Creating workspace...' : 'Create workspace'}
            </Button>
            {created ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void openWorkspace(created)}
              >
                Open chat
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </ForkPageFrame>
  );
}

export function OnboardingPage() {
  return (
    <SessionProvider>
      <OnboardingContent />
    </SessionProvider>
  );
}
