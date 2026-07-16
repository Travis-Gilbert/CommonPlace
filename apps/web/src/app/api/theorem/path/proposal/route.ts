// SOURCING: none — pure logic API route, no upstream component applies
/**
 * PL4 Path proposal proxy: draft / apply / rollback via Theorem MCP.
 */

import { createProposalClients } from '@/lib/path/proposalClients';
import {
  applyPathProposal,
  draftPathProposal,
  rollbackPathProposal,
  type PathProposalDraft,
  type PathProposalReview,
} from '@/lib/path/proposal';

const MCP_URL = process.env.THEOREM_MCP_URL?.trim() || 'http://127.0.0.1:50090/mcp';
const MCP_TOKEN = process.env.THEOREM_MCP_BEARER_TOKEN?.trim();

export const dynamic = 'force-dynamic';

async function callMcp(tool: string, args: Record<string, unknown>) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (MCP_TOKEN) headers.set('Authorization', `Bearer ${MCP_TOKEN}`);
  try {
    const upstream = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: { name: tool, arguments: args },
      }),
      cache: 'no-store',
    });
    const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstream.ok || !payload || payload.error) {
      const err =
        typeof payload?.error === 'object' &&
        payload.error &&
        'message' in payload.error &&
        typeof (payload.error as { message: unknown }).message === 'string'
          ? (payload.error as { message: string }).message
          : `MCP ${tool} unavailable (${upstream.status})`;
      return { ok: false as const, error: err };
    }
    return { ok: true as const, data: payload };
  } catch {
    return { ok: false as const, error: 'Path proposal substrate unreachable.' };
  }
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    action?: 'draft' | 'apply' | 'rollback';
    draft?: PathProposalDraft;
    review?: PathProposalReview;
    existingNodeIds?: string[];
    existingEdges?: Array<{ source: string; target: string; kind?: string }>;
    repository?: Record<string, unknown>;
    targetCommit?: string;
    message?: string;
    parentCommits?: string[];
  } | null;

  const action = body?.action;
  if (!action) {
    return Response.json({ ok: false, error: 'action required: draft|apply|rollback' }, { status: 400 });
  }

  const clients = createProposalClients(callMcp);

  try {
    if (action === 'draft') {
      if (!body?.draft) {
        return Response.json({ ok: false, error: 'draft payload required' }, { status: 400 });
      }
      const review = await draftPathProposal(
        body.draft,
        body.existingNodeIds ?? [],
        clients,
        body.existingEdges ?? [],
      );
      return Response.json({ ok: true, review });
    }

    if (action === 'apply') {
      if (!body?.review) {
        return Response.json({ ok: false, error: 'review payload required' }, { status: 400 });
      }
      const result = await applyPathProposal(body.review, clients, {
        message: body.message,
        parentCommits: body.parentCommits,
      });
      return Response.json({ ok: true, result });
    }

    if (action === 'rollback') {
      if (!body?.repository || !body?.targetCommit) {
        return Response.json(
          { ok: false, error: 'repository and targetCommit required' },
          { status: 400 },
        );
      }
      const result = await rollbackPathProposal(body.repository, body.targetCommit, clients);
      return Response.json({ ok: true, result });
    }

    return Response.json({ ok: false, error: `unknown action ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'proposal failed' },
      { status: 502 },
    );
  }
}
