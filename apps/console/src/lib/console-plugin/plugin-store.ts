'use client';

// SOURCING: @commonplace/console-block plugin contract plus React
// useSyncExternalStore. The server-derived principal owns plugin state; the
// browser neither supplies a tenant to GraphQL nor persists lifecycle truth.

import { useEffect, useSyncExternalStore } from 'react';
import {
  normalizePluginStatus,
  type ConsolePluginStatus,
} from '@commonplace/console-block/plugin';

const listeners = new Set<() => void>();
const statuses = new Map<string, ConsolePluginStatus>();
const hydrations = new Map<string, Promise<void>>();
const LOADING_STATUS: ConsolePluginStatus = {
  state: 'unavailable',
  grants: [],
  contributions: [],
  reason: 'plugin_state_loading',
};
const MISSING_TENANT_STATUS: ConsolePluginStatus = {
  state: 'unavailable',
  grants: [],
  contributions: [],
  reason: 'missing_tenant',
};

function tenantKey(tenant: string | null | undefined): string | null {
  const value = tenant?.trim();
  return value && value.toLowerCase() !== 'default' ? value : null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function write(tenant: string, status: ConsolePluginStatus): ConsolePluginStatus {
  statuses.set(tenant, status);
  notify();
  return status;
}

async function statusResponse(response: Response): Promise<ConsolePluginStatus> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail ?? '')
        : '';
    throw new Error(detail || `Console plugin door is unavailable (${response.status})`);
  }
  const status = normalizePluginStatus(payload);
  if (status.state === 'unavailable') {
    throw new Error(status.reason ?? 'Console plugin door returned invalid state');
  }
  return status;
}

async function fetchStatus(): Promise<ConsolePluginStatus> {
  return statusResponse(
    await fetch('/api/console-plugin/state', {
      cache: 'no-store',
      credentials: 'same-origin',
    }),
  );
}

export function hydrateConsolePlugin(
  tenantInput: string | null | undefined,
): Promise<void> {
  const tenant = tenantKey(tenantInput);
  if (!tenant || typeof window === 'undefined') return Promise.resolve();
  const existing = hydrations.get(tenant);
  if (existing) return existing;
  const hydration = fetchStatus()
    .then((status) => {
      write(tenant, status);
    })
    .catch((cause: unknown) => {
      write(tenant, {
        state: 'unavailable',
        grants: [],
        contributions: [],
        reason: cause instanceof Error ? cause.message : 'plugin_state_unavailable',
      });
    });
  hydrations.set(tenant, hydration);
  return hydration;
}

export function consolePluginStatus(
  tenantInput: string | null | undefined,
): ConsolePluginStatus {
  const tenant = tenantKey(tenantInput);
  if (!tenant) return MISSING_TENANT_STATUS;
  return statuses.get(tenant) ?? LOADING_STATUS;
}

export function requestConsoleConsent(tenantInput: string | null | undefined): ConsolePluginStatus {
  const tenant = tenantKey(tenantInput);
  if (!tenant) return MISSING_TENANT_STATUS;
  return write(tenant, { state: 'pending_consent', grants: [], contributions: [] });
}

async function mutate(
  tenantInput: string | null | undefined,
  action: 'consent' | 'deny' | 'uninstall',
): Promise<ConsolePluginStatus> {
  const tenant = tenantKey(tenantInput);
  if (!tenant) return MISSING_TENANT_STATUS;
  const status = await statusResponse(
    await fetch('/api/console-plugin/state', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
  );
  return write(tenant, status);
}

export function grantConsoleConsent(
  tenantInput: string | null | undefined,
): Promise<ConsolePluginStatus> {
  return mutate(tenantInput, 'consent');
}

export function denyConsoleConsent(
  tenantInput: string | null | undefined,
): Promise<ConsolePluginStatus> {
  return mutate(tenantInput, 'deny');
}

export function uninstallConsole(
  tenantInput: string | null | undefined,
): Promise<ConsolePluginStatus> {
  return mutate(tenantInput, 'uninstall');
}

export function useConsolePlugin(
  tenantInput: string | null | undefined,
): ConsolePluginStatus {
  useEffect(() => {
    void hydrateConsolePlugin(tenantInput);
  }, [tenantInput]);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => consolePluginStatus(tenantInput),
    () => consolePluginStatus(tenantInput),
  );
}
