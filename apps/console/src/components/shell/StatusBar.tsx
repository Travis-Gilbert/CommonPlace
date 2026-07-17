'use client';

// SOURCING: hand-roll. The Int UI status bar is a named chrome signature.
// Connection state includes the named identity-refusal state with a
// reconnect affordance; progress uses the register's indeterminate Blue9 to
// Blue5 treatment (declared in the motion register CSS).

import { useShellStore, type ConnectionState } from '@/lib/shell-store';

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  'identity-refused': 'Identity refused',
};

export function StatusBar() {
  const connection = useShellStore((state) => state.connection);
  const setConnection = useShellStore((state) => state.setConnection);
  const tenant = useShellStore((state) => state.tenant);
  const presenceCount = useShellStore((state) => state.presenceCount);
  const progressLabel = useShellStore((state) => state.progressLabel);

  const needsReconnect = connection === 'identity-refused' || connection === 'disconnected';

  return (
    <footer className="flex h-ij-statusbar shrink-0 items-center gap-3 border-t border-ij-seam bg-ij-chrome px-3 text-ij-ink-info">
      <span
        data-connection={connection}
        style={{ color: connection === 'identity-refused' ? 'var(--ij-error)' : undefined }}
      >
        {CONNECTION_LABEL[connection]}
      </span>
      {needsReconnect ? (
        <button
          type="button"
          onClick={() => setConnection('connecting')}
          className="rounded-ij-arc-underline px-2 text-ij-link hover:bg-ij-hover-surface"
          style={{ transition: 'var(--rec-clickable-transition)' }}
        >
          Reconnect
        </button>
      ) : null}
      {progressLabel ? (
        <span className="flex items-center gap-2">
          <span className="ij-progress-indeterminate h-1 w-32 rounded-ij-arc-underline" />
          {progressLabel}
        </span>
      ) : null}
      <span className="ml-auto">{presenceCount} present</span>
      <span className="font-ij-mono">{tenant}</span>
    </footer>
  );
}
