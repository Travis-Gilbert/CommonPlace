'use client';

// SOURCING: hand-roll. The Int UI status bar is a named chrome signature.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS13 + CS16: metadata size and faint ink,
// one transport claim, progress only while a request is outstanding.

import { signIn, useSession } from 'next-auth/react';
import { githubTenantSlug } from '@/lib/account-identity';
import { useShellStore, type ConnectionState } from '@/lib/shell-store';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { ACCOUNT_SURFACE_ID } from '@/lib/workspace-seed';

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  connecting: 'Transport connecting',
  disconnected: 'Transport unreachable',
  'identity-refused': 'Authentication refused',
  'credential-unavailable': 'Credential unavailable',
  unauthenticated: 'Sign in required',
};

export function StatusBar({ host }: { host: ConsoleBlockHost }) {
  const { data: session } = useSession();
  const connection = useShellStore((state) => state.connection);
  const setConnection = useShellStore((state) => state.setConnection);
  const presenceCount = useShellStore((state) => state.presenceCount);
  const progressLabel = useShellStore((state) => state.progressLabel);
  const tenant = githubTenantSlug(session?.user?.githubLogin) ?? 'Local tenant';

  const showPresence = connection === 'connected' && presenceCount !== null;
  // CS16: progress is an operation in flight, never a standing condition.
  const showProgress = Boolean(progressLabel) && connection === 'connecting';
  const action =
    connection === 'unauthenticated'
      ? { label: 'Sign in', run: () => void signIn('github', { redirectTo: '/' }) }
      : connection === 'credential-unavailable'
        ? {
            label: 'Open Account',
            run: () => {
              void host.activateSurface(ACCOUNT_SURFACE_ID);
            },
          }
        : connection === 'disconnected' || connection === 'identity-refused'
          ? {
              label: 'Reconnect',
              run: () => {
                setConnection('connecting');
                void host.probe();
              },
            }
          : null;

  return (
    <footer
      data-paint-region="status-bar"
      data-frame-resident="status-bar"
      data-connection-owner="status-bar"
      className="flex h-ij-statusbar min-w-0 shrink-0 items-center gap-3 overflow-hidden bg-transparent px-ij-island-gutter text-ij-island-meta text-ij-ink-info"
    >
      <span
        data-connection={connection}
        data-connection-kind={
          connection === 'unauthenticated' ||
          connection === 'identity-refused' ||
          connection === 'credential-unavailable'
            ? 'authentication'
            : 'transport'
        }
        className="min-w-0 truncate"
        style={{
          fontFamily: 'var(--cp-font-human)',
          color:
            connection === 'identity-refused' ||
            connection === 'unauthenticated' ||
            connection === 'credential-unavailable'
              ? 'var(--ij-error)'
              : 'var(--ij-ink-info)',
        }}
      >
        {CONNECTION_LABEL[connection]}
      </span>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="min-w-0 shrink-0 rounded-ij-arc-underline px-2 text-ij-link hover:bg-ij-hover-surface"
          style={{ fontFamily: 'var(--cp-font-human)' }}
        >
          {action.label}
        </button>
      ) : null}
      {showProgress ? (
        <span className="flex min-w-0 items-center gap-2 truncate" data-connection-kind="query">
          <span className="ij-progress-indeterminate h-1 w-24 shrink-0 rounded-ij-arc-underline" />
          <span className="min-w-0 truncate" style={{ fontFamily: 'var(--cp-font-human)' }}>
            {progressLabel}
          </span>
        </span>
      ) : null}
      {showPresence ? (
        <span data-presence={presenceCount} className="ml-auto min-w-0 truncate" style={{ fontFamily: 'var(--cp-font-human)' }}>
          {presenceCount} present
        </span>
      ) : (
        <span className="ml-auto min-w-0" />
      )}
      <span className="min-w-0 shrink truncate font-ij-mono" title={tenant}>
        {tenant}
      </span>
    </footer>
  );
}
