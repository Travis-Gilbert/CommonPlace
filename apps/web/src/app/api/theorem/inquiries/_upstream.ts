// SOURCING: none — pure logic, no upstream component applies
// localInquiryUrl and forwardAuthHeaders moved to packages/theorem-acp with
// the ACP extraction (HANDOFF-CONSOLE-ROUND-2 R2.2); re-exported so existing
// import paths keep working.

export { localInquiryUrl, forwardAuthHeaders } from '@commonplace/theorem-acp/node-upstream';

export const dynamic = 'force-dynamic';

export function stripUntrustedTenantFields(body: Record<string, unknown>): Record<string, unknown> {
  const { tenant: _tenant, tenant_id: _tenantId, ...rest } = body;
  return rest;
}

export function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
