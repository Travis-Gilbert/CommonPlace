// SOURCING: @commonplace/theorem-acp (existing ACP session manager and state
// stream). Intent compilation is an agent run, not a separate harness wire.

import { z } from 'zod';
import {
  dispatchBridgeCommands,
  resolveBridgeSession,
  streamHeaders,
  type BridgeCommand,
} from '@commonplace/theorem-acp/bridge';
import { parseProactivityCompilation } from '@/lib/proactivity/compilation';
import { proactivityCompilationStream } from '@/lib/proactivity/compilation-stream';
import { resolveHarnessPrincipal } from '@/lib/server/harness-principal';
import { stageProactivityCompilation } from '@/lib/server/proactivity-harness';
import {
  acpAuthTokenFromCredential,
  credentialRefusalResponse,
  resolveUpstreamCredential,
  serviceUpstreamKey,
} from '@/lib/server/upstream-credential';
import { ensurePrincipalCredential } from '@/lib/server/principal-credential-store';
import { configuredServiceTenantMatches } from '@/lib/harness-principal-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const compilationRequest = z.object({ intent: z.string().min(1).max(2000) });

export async function POST(request: Request): Promise<Response> {
  const parsed = compilationRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_proactivity_intent', issues: parsed.error.issues }, { status: 400 });
  }
  const resolution = await resolveHarnessPrincipal();
  if (!resolution.ok) return resolution.response;
  const resolvedCredential = await resolveUpstreamCredential(resolution.principal);
  if (!resolvedCredential.ok) {
    return credentialRefusalResponse(resolvedCredential.refusal);
  }
  let authToken = acpAuthTokenFromCredential(resolvedCredential.credential);
  if (!authToken) {
    // ACP bridge cannot carry signature headers yet (SI D5 constraint). Fall
    // back to a principal token or the matching deployment service key.
    const issued = await ensurePrincipalCredential(resolution.principal);
    if (issued) {
      authToken = issued.token;
    } else if (
      configuredServiceTenantMatches(resolution.principal, process.env.CONSOLE_HARNESS_TENANT)
    ) {
      authToken = serviceUpstreamKey();
    } else {
      return Response.json(
        {
          error: 'acp_credential_unavailable',
          message:
            'Signed-request custody is configured, but ACP still needs a principal token or matching service key until SI D5.',
        },
        { status: 403 },
      );
    }
  }
  try {
    const command: BridgeCommand = {
      type: 'add-message',
      message: {
        role: 'user',
        parts: [{
          type: 'text',
          text: [
            'Compile this into candidate proactivity graph nodes only.',
            'Candidates remain pending review. Do not commit, grant, execute, or create an effect contract.',
            'Return only one JSON object with a `candidates` array. Each candidate has kind',
            '(watch, judgment, or response), label, and only its matching optional field:',
            'condition, class, or actionClass. Do not include tenant, grants, effect contracts, or patches.',
            `Intent: ${parsed.data.intent}`,
          ].join('\n\n'),
        }],
      },
      parentId: null,
      sourceId: null,
      displayText: parsed.data.intent,
    };
    const session = await resolveBridgeSession({
      tenant: resolution.principal.tenant,
      authToken,
    });
    await dispatchBridgeCommands(session, [command]);
    return new Response(
      proactivityCompilationStream(
        (listener) => session.subscribe(listener),
        session.getState(),
        request.signal,
        async (text) => {
          const candidates = parseProactivityCompilation(text);
          const id = `compilation-${crypto.randomUUID()}`;
          const staged = await stageProactivityCompilation(id, candidates);
          if (!staged.ok) throw new Error(staged.error);
          return { id, candidates };
        },
      ),
      { status: 200, headers: streamHeaders() },
    );
  } catch (error) {
    return Response.json(
      {
        error: 'proactivity_compilation_unavailable',
        message: error instanceof Error ? error.message : 'The hosted Theorem ACP session is unavailable.',
      },
      { status: 502 },
    );
  }
}
