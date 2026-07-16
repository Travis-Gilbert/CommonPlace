// SOURCING: none — pure logic, no upstream component applies
/**
 * MCP clients for PL4 Path proposals.
 */

import type { PathProposalClients, PathProposalDraft } from './proposal';

export type McpCaller = (
  tool: string,
  args: Record<string, unknown>,
) => Promise<{ ok: boolean; data?: unknown; error?: string }>;

const TENANT = 'Travis-Gilbert';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function unwrap(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const record = data as Record<string, unknown>;
  const result = record.result ?? record;
  if (result && typeof result === 'object') {
    const content = (result as Record<string, unknown>).content;
    if (Array.isArray(content)) {
      const text = content
        .map((part) =>
          part && typeof part === 'object' && 'text' in part
            ? String((part as { text: unknown }).text)
            : '',
        )
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

function toProgram(draft: PathProposalDraft): Record<string, unknown> {
  if (draft.program) return draft.program;
  return {
    kind: 'path_dag_proposal',
    title: draft.title,
    nodes: draft.nodes,
    edges: draft.edges,
  };
}

export function createProposalClients(call: McpCaller): PathProposalClients {
  return {
    async validateOrProject(draft) {
      const program = toProgram(draft);
      const res = await call('programmable_graph', {
        action: 'project',
        program,
        tenant: TENANT,
      });
      if (!res.ok) {
        const validate = await call('programmable_graph', {
          action: 'validate',
          program,
          tenant: TENANT,
        });
        if (!validate.ok) {
          return { ok: false, error: validate.error || res.error || 'validate failed' };
        }
        return { ok: true, projection: asRecord(unwrap(validate.data)) };
      }
      return { ok: true, projection: asRecord(unwrap(res.data)) };
    },

    async applyProgram(draft) {
      const res = await call('programmable_graph_apply', {
        action: 'materialize',
        program: toProgram(draft),
        tenant: TENANT,
      });
      return res.ok
        ? { ok: true }
        : { ok: false, error: res.error || 'programmable_graph_apply failed' };
    },

    async compileVersion(input) {
      const res = await call('rustyred_thg_graph_version_compile', {
        message: input.message,
        author: input.author ?? 'path-lens',
        parent_commits: input.parentCommits ?? [],
        include_payloads: true,
        tenant: TENANT,
      });
      if (!res.ok) throw new Error(res.error || 'graph_version_compile failed');
      const payload = asRecord(unwrap(res.data));
      const commitId = String(
        payload.commit_id ?? payload.commitId ?? payload.id ?? payload.hash ?? '',
      );
      if (!commitId) throw new Error('graph_version_compile returned no commit id');
      return {
        commitId,
        repository: asRecord(payload.repository ?? payload),
      };
    },

    async checkoutVersion(input) {
      const res = await call('rustyred_thg_graph_version_checkout', {
        repository: input.repository,
        target: input.target,
        tenant: TENANT,
      });
      if (!res.ok) return { ok: false, error: res.error || 'checkout failed' };
      return { ok: true, snapshot: asRecord(unwrap(res.data)) };
    },

    async versionLog(repository) {
      const res = await call('rustyred_thg_graph_version_log', {
        repository,
        tenant: TENANT,
      });
      if (!res.ok) return [];
      const payload = unwrap(res.data);
      if (Array.isArray(payload)) {
        return payload.map((entry) =>
          typeof entry === 'string'
            ? entry
            : String(asRecord(entry).commit_id ?? asRecord(entry).id ?? ''),
        ).filter(Boolean);
      }
      const commits = asRecord(payload).commits;
      if (Array.isArray(commits)) {
        return commits.map((entry) =>
          typeof entry === 'string'
            ? entry
            : String(asRecord(entry).commit_id ?? asRecord(entry).id ?? ''),
        ).filter(Boolean);
      }
      return [];
    },
  };
}
