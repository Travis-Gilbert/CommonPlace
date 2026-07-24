// SOURCING: @commonplace/host-bridge — factory picks Web vs Tauri vs Gpui
// adapter so apps/console never branches on transport at call sites
// (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B1). Console is the canonical React host
// surface; queryObjects is injected from ConsoleBlockHost (not apps/web GraphQL).

import {
  GpuiHostAdapter,
  TauriHostAdapter,
  WebHostAdapter,
  type CommonplaceHost,
  type ObjectQuery,
  type ObjectSet,
  type OpenTarget,
  createLoopbackStore,
} from '@commonplace/host-bridge';

export type HostKind = 'web' | 'tauri' | 'gpui-loopback';

export interface CreateHostOptions {
  /** Force a specific adapter (tests / Gpui harness). */
  kind?: HostKind;
  /** Shared workspace id for default subscriptions. */
  workspaceId?: string;
  /** Object query transport; required for the web adapter. */
  queryObjects?: (q: ObjectQuery) => Promise<ObjectSet>;
  /** Optional openTarget side effects (search panel, navigation). */
  onOpenTarget?: (t: OpenTarget) => void | Promise<void>;
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ===
      'object'
  );
}

async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const bridge = (
    window as {
      __TAURI_INTERNALS__?: {
        invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
      };
    }
  ).__TAURI_INTERNALS__;
  if (!bridge?.invoke) {
    throw new Error('Tauri invoke bridge is not available');
  }
  return bridge.invoke(cmd, args) as Promise<T>;
}

/**
 * Create the process-local CommonplaceHost. React code should take the host
 * from `useHost()` rather than calling this repeatedly.
 */
export function createHost(options: CreateHostOptions = {}): CommonplaceHost {
  const store = createLoopbackStore({
    contributions: [
      { id: 'pane.note', paneKind: 'note', label: 'Note' },
      { id: 'pane.browser', paneKind: 'browser', label: 'Browser' },
    ],
  });
  const kind: HostKind =
    options.kind ?? (isTauriRuntime() ? 'tauri' : 'web');

  const openTarget = async (t: OpenTarget) => {
    if (options.onOpenTarget) await options.onOpenTarget(t);
  };

  if (kind === 'gpui-loopback') {
    const gpui = new GpuiHostAdapter(store);
    const innerOpen = gpui.openTarget.bind(gpui);
    gpui.openTarget = async (t) => {
      await innerOpen(t);
      await openTarget(t);
    };
    return gpui;
  }

  if (kind === 'tauri') {
    return new TauriHostAdapter(
      async <T>(cmd: string, args?: Record<string, unknown>) =>
        tauriInvoke<T>(cmd, args),
      store,
    );
  }

  const queryObjects =
    options.queryObjects ??
    (async () => ({ objects: [], total: 0 }) satisfies ObjectSet);

  return new WebHostAdapter(
    {
      queryObjects,
      openTarget,
    },
    store,
  );
}
