export const CONSOLE_APP_ID = 'commonplace.console';
export const CONSOLE_PANE_KIND = 'commonplace.console';
export const CORPUS_READ_GRANT = 'corpus:read';

export const CONSOLE_PLUGIN_MANIFEST = {
  app_id: CONSOLE_APP_ID,
  version: '1.0.0',
  name: 'Your data console',
  description: 'Read your CommonPlace records, receipts, watches, and graph.',
  grants: [CORPUS_READ_GRANT],
  network: 'door_only',
  contributions: [
    {
      point: 'pane.kind',
      block: CONSOLE_PANE_KIND,
      kind: 'view',
      value: 'commonplace.console',
    },
  ],
} as const;

export type ConsolePluginLifecycleState =
  | 'available'
  | 'pending_consent'
  | 'installed'
  | 'denied'
  | 'unavailable';

export interface ConsolePluginStatus {
  readonly state: ConsolePluginLifecycleState;
  readonly grants: readonly string[];
  readonly contributions: readonly string[];
  readonly reason?: string;
}

export function canMountConsole(status: ConsolePluginStatus): boolean {
  return (
    status.state === 'installed' &&
    status.grants.includes(CORPUS_READ_GRANT) &&
    status.contributions.includes(`pane:${CONSOLE_PANE_KIND}`)
  );
}

export function normalizePluginStatus(value: unknown): ConsolePluginStatus {
  if (!value || typeof value !== 'object') {
    return {
      state: 'unavailable',
      grants: [],
      contributions: [],
      reason: 'plugin_state_unavailable',
    };
  }
  const record = value as Record<string, unknown>;
  const state = record.state;
  if (
    state !== 'available' &&
    state !== 'pending_consent' &&
    state !== 'installed' &&
    state !== 'denied'
  ) {
    return {
      state: 'unavailable',
      grants: [],
      contributions: [],
      reason: 'plugin_state_invalid',
    };
  }
  return {
    state,
    grants: Array.isArray(record.grants)
      ? record.grants.filter((grant): grant is string => typeof grant === 'string')
      : [],
    contributions: Array.isArray(record.contributions)
      ? record.contributions.filter(
          (contribution): contribution is string => typeof contribution === 'string',
        )
      : [],
  };
}

export class FixturePluginController {
  #status: ConsolePluginStatus;
  #listeners = new Set<(status: ConsolePluginStatus) => void>();

  constructor(initialState: ConsolePluginLifecycleState = 'available') {
    this.#status = { state: initialState, grants: [], contributions: [] };
  }

  status(): ConsolePluginStatus {
    return this.#status;
  }

  requestConsent(): ConsolePluginStatus {
    return this.#set({ state: 'pending_consent', grants: [], contributions: [] });
  }

  consent(): ConsolePluginStatus {
    return this.#set({
      state: 'installed',
      grants: [CORPUS_READ_GRANT],
      contributions: [`pane:${CONSOLE_PANE_KIND}`],
    });
  }

  deny(): ConsolePluginStatus {
    return this.#set({ state: 'denied', grants: [], contributions: [] });
  }

  uninstall(): ConsolePluginStatus {
    return this.#set({ state: 'available', grants: [], contributions: [] });
  }

  subscribe(listener: (status: ConsolePluginStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #set(status: ConsolePluginStatus): ConsolePluginStatus {
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
    return status;
  }
}
