// SOURCING: none. Map failed harness principal resolution to a non-looping route.

import { redirect } from 'next/navigation';
import type { HarnessPrincipalResolution } from '@/lib/server/harness-principal';

const ACTIVE_WORKSPACE_ERRORS = new Set([
  'active_workspace_claim_required',
  'active_workspace_claim_refused',
  'active_workspace_membership_refused',
  'active_workspace_configuration_missing',
  'active_workspace_claim_unavailable',
  'active_workspace_contract_mismatch',
  'active_workspace_unconfigured',
]);

export async function redirectForFailedPrincipal(
  resolution: Extract<HarnessPrincipalResolution, { readonly ok: false }>,
  loginCallback: string,
): Promise<never> {
  let error: string | undefined;
  try {
    const body = await resolution.response.clone().json() as { error?: unknown };
    error = typeof body.error === 'string' ? body.error : undefined;
  } catch {
    error = undefined;
  }
  if (error && ACTIVE_WORKSPACE_ERRORS.has(error)) {
    redirect('/onboarding');
  }
  const safe = loginCallback.startsWith('/') && !loginCallback.startsWith('//')
    ? loginCallback
    : '/chat';
  redirect(`/login?callbackUrl=${encodeURIComponent(safe)}`);
}
