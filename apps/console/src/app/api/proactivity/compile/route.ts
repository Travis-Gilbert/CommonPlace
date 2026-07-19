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
import {
  configuredServiceTenantMatches,
  resolveHarnessPrincipal,
} from '@/lib/server/harness-principal';
import { stageProactivityCompilation } from '@/lib/server/proactivity-harness';

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
  if (!configuredServiceTenantMatches(resolution.principal)) {
    return Response.json(
      {
        error: 'tenant_connector_unavailable',
        message: 'This signed-in tenant does not yet have a matching hosted ACP credential.',
      },
      { status: 403 },
    );
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
    const session = await resolveBridgeSession({});
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
