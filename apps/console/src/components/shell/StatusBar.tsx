'use client';

// SOURCING: hand-roll. The Int UI status bar is a named chrome signature.
// Connection state binds to the real object-seam transport (R2.3): the named
// identity-refusal state maps HTTP 403 (the principal_resolution=
// unauthenticated analog) and Reconnect runs a real health probe. Presence
// renders only when the harness transport reports it (R2.4); it can never
// contradict the connection state because it hides unless connected.

import { useShellStore, type ConnectionState } from '@/lib/shell-store';
import type { ConsoleBlockHost } from '@/lib/console-host';

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: 'Connected',
  connecting: 'Connecting',
  disconnected: 'Disconnected',
  'identity-refused': 'Identity refused',
};

export function StatusBar({ host }: { host: ConsoleBlockHost }) {
  const connection = useShellStore((state) => state.connection);
  const setConnection = useShellStore((state) => state.setConnection);
  const tenant = useShellStore((state) => state.tenant);
  const presenceCount = useShellStore((state) => state.presenceCount);
  const progressLabel = useShellStore((state) => state.progressLabel);

  const needsReconnect = connection === 'identity-refused' || connection === 'disconnected';
  const showPresence = connection === 'connected' && presenceCount !== null;

  return (
    <footer
      data-paint-region="status-bar"
      data-frame-resident="status-bar"
      className="flex h-ij-statusbar shrink-0 items-center gap-3 bg-transparent px-ij-island-gutter font-ij-mono text-ij-ink-info"
    >
      <span
        data-connection={connection}
        style={{ color: connection === 'identity-refused' ? 'var(--ij-error)' : undefined }}
      >
        {CONNECTION_LABEL[connection]}
      </span>
      {needsReconnect ? (
        <button
          type="button"
          onClick={() => {
            setConnection('connecting');
            void host.probe();
          }}
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
      {showPresence ? (
        <span data-presence={presenceCount} className="ml-auto">
          {presenceCount} present
        </span>
      ) : (
        <span className="ml-auto" />
      )}
      <span className="font-ij-mono">{tenant}</span>
    </footer>
  );
}
