// SOURCING: none — pure logic, no upstream component applies
/**
 * Browser / server clients that talk to the Theorem MCP substrate for Path.
 * Injected into pathTo so tests can stub without a live node.
 */

import type {
  CodeReachResult,
  FoldSemiringResult,
  MemorySupportResult,
  PathClients,
  PlanBlockedResult,
  WhyTraceResult,
} from './pathTo';

const TENANT = 'Travis-Gilbert';

export interface McpToolCallResult {
  readonly ok: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

export type McpCaller = (
  tool: string,
  args: Record<string, unknown>,
) => Promise<McpToolCallResult>;

function unwrapContent(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const record = data as Record<string, unknown>;
  const result = record.result ?? record;
  if (result && typeof result === 'object') {
    const content = (result as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (part && typeof part === 'object' && 'text' in part) {
            return String((part as { text: unknown }).text);
          }
          return '';
        })
        .join('');
      if (text) {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text;
        }
      }
    }
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function createPathClients(call: McpCaller): PathClients {
  return {
    async whyDerivationTrace(nodeId) {
      const res = await call('why_derivation_trace', { node_id: nodeId, tenant: TENANT });
      if (!res.ok) throw new Error(res.error || 'why_derivation_trace failed');
      return unwrapContent(res.data) as WhyTraceResult;
    },
    async foldSemiringTropical(nodeId) {
      const res = await call('fold_semiring', {
        node_id: nodeId,
        semiring_kind: 'tropical',
        tenant: TENANT,
      });
      if (!res.ok) throw new Error(res.error || 'fold_semiring failed');
      return unwrapContent(res.data) as FoldSemiringResult;
    },
    async planBlocked(nodeId) {
      const res = await call('plan', {
        action: 'query',
        query_mode: 'blocked_set',
        node_id: nodeId,
        tenant: TENANT,
      });
      if (!res.ok) throw new Error(res.error || 'plan blocked_set failed');
      const payload = asRecord(unwrapContent(res.data));
      return {
        blocked_set: (payload.blocked_set ?? payload.blockedBy) as PlanBlockedResult['blocked_set'],
        blockedBy: payload.blockedBy as PlanBlockedResult['blockedBy'],
        status: payload.status as PlanBlockedResult['status'],
        chain: payload.chain as PlanBlockedResult['chain'],
        next_actionable: payload.next_actionable as PlanBlockedResult['next_actionable'],
      };
    },
    async memorySupport(nodeId) {
      const res = await call('retrieve_memory', {
        query: nodeId,
        tenant_slug: TENANT,
        limit: 24,
      });
      if (!res.ok) throw new Error(res.error || 'retrieve_memory failed');
      const payload = unwrapContent(res.data);
      const records = Array.isArray(asRecord(payload).records)
        ? (asRecord(payload).records as Array<Record<string, unknown>>)
        : Array.isArray(payload)
          ? (payload as Array<Record<string, unknown>>)
          : [];
      return {
        support: records
          .map((r) => ({
            id: String(r.id ?? r.doc_id ?? ''),
            label: typeof r.title === 'string' ? r.title : undefined,
            type: typeof r.type === 'string' ? r.type : 'memory',
          }))
          .filter((n) => n.id),
      } satisfies MemorySupportResult;
    },
    async codeReach(nodeId) {
      const res = await call('understand_code', {
        operation: 'explore',
        node_id: nodeId,
        tenant: TENANT,
      });
      if (!res.ok) {
        const impact = await call('impact', { node_id: nodeId, tenant: TENANT });
        if (!impact.ok) throw new Error(res.error || 'code reach failed');
        const payload = asRecord(unwrapContent(impact.data));
        const neighbors = Array.isArray(payload.neighbors)
          ? (payload.neighbors as Array<Record<string, unknown> | string>)
          : [];
        return {
          reaches: neighbors
            .map((n) =>
              typeof n === 'string'
                ? { id: n }
                : {
                    id: String(n.id ?? ''),
                    label: typeof n.label === 'string' ? n.label : undefined,
                  },
            )
            .filter((n) => n.id),
        } satisfies CodeReachResult;
      }
      const payload = asRecord(unwrapContent(res.data));
      const nodes = Array.isArray(payload.nodes)
        ? (payload.nodes as Array<Record<string, unknown>>)
        : Array.isArray(payload.chain)
          ? (payload.chain as Array<Record<string, unknown>>)
          : [];
      return {
        chain: nodes
          .map((n) => ({
            id: String(n.id ?? n.node_id ?? ''),
            label: typeof n.label === 'string' ? n.label : undefined,
            type: typeof n.type === 'string' ? n.type : 'code',
          }))
          .filter((n) => n.id),
      };
    },
  };
}
