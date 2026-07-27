'use client';

// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// paths=frontend/src/pages/Invite/index.jsx,frontend/src/models/invite.js.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionProvider, signIn, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  acceptIdentityInvite,
  IdentityClientError,
  inspectIdentityInvite,
  selectIdentityWorkspace,
} from '@/lib/identity/client';
import type { IdentityInvite, IdentityWorkspace } from '@/lib/identity/contracts';
import { ForkNotice, ForkPageFrame, ForkPanel } from './ForkPageFrame';

type InviteState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly invite: IdentityInvite }
  | {
      readonly status: 'accepted';
      readonly workspace: IdentityWorkspace;
      readonly selectionError?: string;
    }
  | { readonly status: 'error'; readonly message: string };

function InviteContent({ code }: { readonly code: string }) {
  const session = useSession();
  const [state, setState] = useState<InviteState>({ status: 'loading' });
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    void inspectIdentityInvite(code)
      .then((invite) => {
        if (active) setState({ status: 'ready', invite });
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof IdentityClientError
              ? error.message
              : 'This invitation is unavailable',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [code]);

  const claim = async () => {
    setClaiming(true);
    let workspace: IdentityWorkspace;
    try {
      workspace = await acceptIdentityInvite(code);
      setState({ status: 'accepted', workspace });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof IdentityClientError
          ? error.message
          : 'The invitation could not be accepted',
      });
      setClaiming(false);
      return;
    }
    try {
      await selectIdentityWorkspace(workspace.id);
    } catch (error) {
      setState({
        status: 'accepted',
        workspace,
        selectionError: error instanceof IdentityClientError
          ? error.message
          : 'The workspace could not be selected for chat',
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ForkPageFrame
      eyebrow="Invitation"
      title="Join a CommonPlace workspace"
      description="The invitation grants one role in one identity workspace. Graph access is derived from that membership on the server."
    >
      <ForkPanel title="Invitation status">
        {state.status === 'loading' ? (
          <p aria-live="polite" className="text-ij-ink-info">Checking invitation...</p>
        ) : state.status === 'error' ? (
          <ForkNotice tone="error">{state.message}</ForkNotice>
        ) : state.status === 'accepted' ? (
          <div className="grid gap-3">
            <ForkNotice tone="success">
              You joined {state.workspace.name} as {state.workspace.role.name}.
            </ForkNotice>
            {'selectionError' in state ? (
              <ForkNotice tone="error">
                {state.selectionError}. Select it from workspace settings before opening chat.
              </ForkNotice>
            ) : null}
            <Button asChild>
              <Link href={`/workspace/${encodeURIComponent(state.workspace.slug)}/${'selectionError' in state ? 'settings' : 'chat'}`}>
                {'selectionError' in state ? 'Open workspace settings' : 'Open workspace chat'}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-ij-ink-info">Workspace</dt>
                <dd style={{ fontWeight: 'var(--rec-weight-cap)' }}>{state.invite.workspace.name}</dd>
              </div>
              <div>
                <dt className="text-ij-ink-info">Role</dt>
                <dd>{state.invite.role.name}</dd>
              </div>
              <div>
                <dt className="text-ij-ink-info">Tenant</dt>
                <dd className="font-ij-mono">{state.invite.workspace.tenant}</dd>
              </div>
              <div>
                <dt className="text-ij-ink-info">Expires</dt>
                <dd>{new Date(state.invite.expiresAt).toLocaleString()}</dd>
              </div>
            </dl>
            {session.status === 'authenticated' ? (
              <Button type="button" disabled={claiming} onClick={() => void claim()}>
                {claiming ? 'Accepting invitation...' : 'Accept invitation'}
              </Button>
            ) : session.status === 'unauthenticated' ? (
              <Button
                type="button"
                onClick={() => void signIn('github', { redirectTo: `/invite/${encodeURIComponent(code)}` })}
              >
                Sign in to accept
              </Button>
            ) : (
              <p className="text-ij-ink-info">Checking your session...</p>
            )}
          </div>
        )}
      </ForkPanel>
    </ForkPageFrame>
  );
}

export function InvitePage({ code }: { readonly code: string }) {
  return (
    <SessionProvider>
      <InviteContent code={code} />
    </SessionProvider>
  );
}
