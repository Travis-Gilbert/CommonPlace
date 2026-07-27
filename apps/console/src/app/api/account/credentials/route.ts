// SOURCING: none. Pure logic, no upstream component applies.
// Account credential issuance and listing for HANDOFF-PRINCIPAL-CREDENTIALS D4.

import { NextResponse } from 'next/server';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import {
  ensurePrincipalCredential,
  forgetIssuedCredential,
  listCachedCredentialMeta,
} from '@/lib/server/principal-credential-store';
import { isServicePrincipal } from '@/lib/server/upstream-credential';

export async function GET() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  if (isServicePrincipal(resolution.principal)) {
    return NextResponse.json({
      kind: 'service_key',
      message: 'Service principals use the deployment service credential.',
    });
  }
  const issued = await ensurePrincipalCredential(resolution.principal);
  const meta = listCachedCredentialMeta(resolution.principal);
  if (!issued || !meta) {
    return NextResponse.json(
      {
        error: 'principal_credential_unavailable',
        message: 'Could not issue a principal credential for this tenant.',
      },
      { status: 403 },
    );
  }
  // Never return the token secret after issuance.
  return NextResponse.json({
    kind: 'principal_token',
    keyId: meta.keyId,
    tenant: meta.tenant,
    expiresAtMs: meta.expiresAtMs,
  });
}

export async function DELETE() {
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  forgetIssuedCredential(resolution.principal);
  return new NextResponse(null, { status: 204 });
}
