// SOURCING: zod. Rule authoring and the pending-consent flow for
// agent-proposed rules. Consent lives here and not on corrections: a
// correction acts once and is undoable, a rule keeps acting.

import { ruleActionSchema } from '@/lib/filing/actions';
import {
  consentRule,
  deleteRule,
  denyRule,
  putRule,
  readRules,
} from '@/lib/server/filing-harness';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const result = await readRules();
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tenant: result.tenant, rules: result.data });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = ruleActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_rule_action', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const action = parsed.data;
  switch (action.kind) {
    case 'put': {
      const result = await putRule({
        id: action.id,
        predicates: action.predicates,
        destination: action.destination,
        urgent: action.urgent,
      });
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ tenant: result.tenant, rule: result.data });
    }
    case 'consent': {
      const result = await consentRule(action.id);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ tenant: result.tenant, rule: result.data });
    }
    case 'deny': {
      const result = await denyRule(action.id);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ tenant: result.tenant, denied: action.id });
    }
    case 'delete': {
      const result = await deleteRule(action.id);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      return Response.json({ tenant: result.tenant, deleted: action.id });
    }
  }
}
