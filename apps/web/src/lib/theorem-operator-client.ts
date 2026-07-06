/**
 * Browser client for the Operator surface. Thin fetch wrappers over
 * GET/POST /api/theorem/operator, mirroring theorem-control-center-client.ts.
 */
import type { OperatorAction, OperatorActionResult, OperatorState } from './theorem-operator';

const ENDPOINT = '/api/theorem/operator';

export async function fetchOperatorState(): Promise<OperatorState> {
  const res = await fetch(ENDPOINT, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Operator state unavailable (${res.status}).`);
  return res.json();
}

export async function postOperatorAction(action: OperatorAction): Promise<OperatorActionResult> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    cache: 'no-store',
  });
  const result = (await res.json().catch(() => null)) as OperatorActionResult | null;
  if (!result) throw new Error(`Operator action failed (${res.status}).`);
  return result;
}
