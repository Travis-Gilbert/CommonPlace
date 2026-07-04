/**
 * Browser client for the Agent Workroom Control Center.
 *
 * Thin transport over the same-origin `/api/theorem/control-center` route
 * (see app/api/theorem/control-center/route.ts). GET returns the full
 * TheoremControlCenterState; POST runs a typed action and returns a receipted
 * result. The DTO contract lives in theorem-control-center.ts (Codex-owned
 * backend lane); this file only moves it across the wire.
 */

import type {
  TheoremControlCenterState,
  TheoremControlCenterAction,
  TheoremControlCenterActionResult,
} from './theorem-control-center';

const ENDPOINT = '/api/theorem/control-center';

export async function fetchControlCenterState(): Promise<TheoremControlCenterState> {
  const res = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Control center state unavailable (${res.status}).`);
  }
  return res.json();
}

export async function postControlCenterAction(
  action: TheoremControlCenterAction,
): Promise<TheoremControlCenterActionResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    cache: 'no-store',
  });
  const result = (await res
    .json()
    .catch(() => null)) as TheoremControlCenterActionResult | null;
  if (!result) {
    throw new Error(`Control center action failed (${res.status}).`);
  }
  return result;
}
