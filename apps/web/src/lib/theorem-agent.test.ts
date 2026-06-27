import { afterEach, describe, expect, it, vi } from 'vitest';

import { gqlTheoremAgent } from '@/lib/commonplace-graphql';
import { runTheoremAgent } from '@/lib/theorem-agent';

vi.mock('@/lib/commonplace-graphql', () => ({
  gqlTheoremAgent: vi.fn(),
}));

describe('runTheoremAgent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to the product route when GraphQL has no configured provider heads', async () => {
    vi.mocked(gqlTheoremAgent).mockRejectedValue(
      new Error(
        'composed_agent_run has no runtime-configured provider heads; set THEOREM_AGENT_HEADS and at least one matching *_API_KEY',
      ),
    );
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          result: {
            binding_id: 'agent:theorem:test',
            run_id: 'run:test',
            invocation_receipts: [
              {
                head_id: 'deepseek',
                payload: { text: 'Fallback route answered.' },
                claims: [],
              },
            ],
            consensus_head_set: ['deepseek'],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const result = await runTheoremAgent({
      task: 'Can DeepSeek answer from the Omnibar?',
      bindingId: 'agent:theorem:test',
    });

    expect(result.answer).toBe('Fallback route answered.');
    expect(result.heads).toEqual(['deepseek']);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/theorem/agent',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
      }),
    );
  });
});
