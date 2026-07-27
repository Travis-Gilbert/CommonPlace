'use client';

// SOURCING: cmdk Dialog for the normal focus-managed consent surface;
// @commonplace/console-block owns the plugin lifecycle and grant contract.

import { useState } from 'react';
import { Command } from 'cmdk';
import type { BlockHost } from '@commonplace/block-view/types';
import { canMountConsole } from '@commonplace/console-block/plugin';
import {
  denyConsoleConsent,
  grantConsoleConsent,
  requestConsoleConsent,
  uninstallConsole,
  useConsolePlugin,
} from '@/lib/console-plugin/plugin-store';
import {
  activateConsoleDataSurface,
  activateFallbackSurface,
  unmountConsoleDataSurface,
} from '@/lib/console-plugin/open-console';
import { useShellStore } from '@/lib/shell-store';

export function YourDataEntry({
  host,
  returnSurfaceId,
  compact = false,
}: {
  readonly host: BlockHost;
  readonly returnSurfaceId: string;
  readonly compact?: boolean;
}) {
  const tenant = useShellStore((state) => state.tenant);
  const status = useConsolePlugin(tenant);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const installed = canMountConsole(status);
  const consentOpen = status.state === 'pending_consent';

  const openConsole = async (): Promise<void> => {
    if (!(await activateConsoleDataSurface(host))) {
      throw new Error('The Your data pane could not be mounted in this workspace.');
    }
  };

  const run = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The plugin door is unavailable.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-your-data-entry
      data-your-data-state={status.state}
      className={
        compact
          ? 'grid gap-2 border-b border-ij-seam bg-ij-chrome p-2 text-ij-ink'
          : 'grid gap-3 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-4 text-ij-ink'
      }
      aria-labelledby={compact ? 'index-your-data-heading' : 'settings-your-data-heading'}
    >
      <div className="grid gap-1">
        <h2
          id={compact ? 'index-your-data-heading' : 'settings-your-data-heading'}
          style={{ fontWeight: 'var(--rec-weight-cap)' }}
        >
          Your data
        </h2>
        <p className="text-ij-ink-info">
          See your records, receipts, watches, and graph in one read-only pane.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-your-data-open
          disabled={status.state === 'unavailable' || busy}
          onClick={() => {
            if (installed) void run(openConsole);
            else requestConsoleConsent(tenant);
          }}
          className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover disabled:text-ij-ink-disabled"
        >
          {installed ? 'Open Your data' : 'Set up Your data'}
        </button>
        {installed ? (
          <button
            type="button"
            data-your-data-uninstall
            disabled={busy}
            onClick={() => {
              void run(async () => {
                await uninstallConsole(tenant);
                await activateFallbackSurface(host, returnSurfaceId);
                if (!(await unmountConsoleDataSurface(host))) {
                  throw new Error('The Your data pane could not be unmounted.');
                }
              });
            }}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-4 text-ij-ink hover:bg-ij-hover-surface"
          >
            Uninstall
          </button>
        ) : null}
        <span className="text-ij-ink-info">
          {installed
            ? 'Installed with corpus:read.'
            : status.state === 'denied'
              ? 'Not installed. You can review access again.'
              : status.state === 'unavailable'
                ? status.reason === 'plugin_state_loading'
                  ? 'Checking installation state.'
                  : 'The authenticated plugin door is unavailable.'
                : 'Not installed.'}
        </span>
      </div>
      {error ? <p role="alert" className="text-ij-error">{error}</p> : null}

      <Command.Dialog
        open={consentOpen}
        onOpenChange={(next) => {
          if (!next && consentOpen && !busy) {
            void run(async () => {
              await denyConsoleConsent(tenant);
            });
          }
        }}
        label="Your data access"
        shouldFilter={false}
        overlayClassName="fixed inset-0 z-50 bg-ij-frame opacity-75"
        contentClassName="your-data-consent-content fixed inset-x-0 z-50 mx-auto max-w-full outline-none"
      >
        <div
          data-your-data-consent
          className="overflow-hidden rounded-ij-arc border border-ij-seam bg-ij-raised text-ij-ink"
        >
          <header className="border-b border-ij-divider px-4 py-3">
            <div className="text-ij-ink-info">Your data</div>
            <h3 className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Allow read-only access?
            </h3>
          </header>
          <Command.List className="grid gap-3 p-4">
            <p>
              This installs the Your data pane so you can inspect your own CommonPlace
              records, receipts, watches, and graph.
            </p>
            <dl className="grid gap-2 rounded-ij-arc bg-ij-chrome p-3">
              <div className="grid gap-1">
                <dt className="text-ij-ink-info">Permission</dt>
                <dd><code className="font-ij-mono">corpus:read</code></dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-ij-ink-info">What it can do</dt>
                <dd>Read through the authenticated CommonPlace door.</dd>
              </div>
              <div className="grid gap-1">
                <dt className="text-ij-ink-info">What it cannot do</dt>
                <dd>Write your data or use arbitrary network endpoints.</dd>
              </div>
            </dl>
          </Command.List>
          <div className="flex gap-2 border-t border-ij-divider p-3">
            <button
              type="button"
              data-your-data-deny
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  await denyConsoleConsent(tenant);
                });
              }}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
            >
              Not now
            </button>
            <button
              type="button"
              data-your-data-consent-allow
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  const next = await grantConsoleConsent(tenant);
                  if (!canMountConsole(next)) {
                    throw new Error('The consent receipt did not activate the pane contribution.');
                  }
                  await openConsole();
                });
              }}
              className="ml-auto h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright hover:bg-ij-accent-hover"
            >
              Allow read-only access
            </button>
          </div>
        </div>
      </Command.Dialog>
    </section>
  );
}
