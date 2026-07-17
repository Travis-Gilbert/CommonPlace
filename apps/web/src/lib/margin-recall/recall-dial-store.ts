// SOURCING: none; local persistence for the D7 global recall dial (HANDOFF-MARGIN-RECALL).
// Mirrors the local-agent settings store (localStorage), the project's established
// local-preference pattern. The global dial is a user preference; per-site overrides are the
// durable Tauri store (desktop.ts site_policy). No upstream dependency; carries no DOM.

import { DEFAULT_RECALL_DIAL, type RecallPolicy } from './recall-dial';

const STORAGE_KEY = 'commonplace.recallDial.v1';

function isRecallPolicy(value: unknown): value is RecallPolicy {
  return value === 'off' || value === 'quiet' || value === 'active';
}

/** The persisted global dial position, or the Quiet default (D7-1) when unset or in SSR. */
export function readRecallDial(): RecallPolicy {
  if (typeof window === 'undefined') return DEFAULT_RECALL_DIAL;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isRecallPolicy(raw) ? raw : DEFAULT_RECALL_DIAL;
}

/** Persist the global dial position. */
export function writeRecallDial(policy: RecallPolicy): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, policy);
}
