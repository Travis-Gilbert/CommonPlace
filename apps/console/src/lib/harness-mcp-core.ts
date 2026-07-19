import type { HarnessPrincipal } from '@/lib/harness-principal-core';

export function identityBoundArguments(
  argumentsValue: Record<string, unknown>,
  principal: HarnessPrincipal,
): Record<string, unknown> {
  return {
    ...argumentsValue,
    tenant: principal.tenant,
    tenant_slug: principal.tenant,
    actor: principal.harnessIdentity,
  };
}
