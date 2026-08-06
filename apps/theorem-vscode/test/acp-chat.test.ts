// SOURCING: none. Spec-review completion Pass B/C — ACP chunk forward + acpConfigured.
import { describe, expect, it, vi } from 'vitest';
import { forwardAgentMessageChunk } from '../src/agent/acp-chunks';
import { resolveTheoremPackConfig } from '../src/config';

function fakeConfig(values: Record<string, string | undefined>) {
  return {
    get<T>(key: string): T | undefined {
      return values[key] as T | undefined;
    },
  };
}

describe('forwardAgentMessageChunk', () => {
  it('forwards agent_message_chunk text for the active session', () => {
    const onDelta = vi.fn();
    forwardAgentMessageChunk(
      'sess-1',
      {
        sessionId: 'sess-1',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
        },
      },
      onDelta,
    );
    expect(onDelta).toHaveBeenCalledWith('hello');
  });

  it('ignores other sessions and update kinds', () => {
    const onDelta = vi.fn();
    forwardAgentMessageChunk(
      'sess-1',
      {
        sessionId: 'other',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'nope' },
        },
      },
      onDelta,
    );
    forwardAgentMessageChunk(
      'sess-1',
      {
        sessionId: 'sess-1',
        update: { sessionUpdate: 'theorem_turn_activity', status: 'running' },
      },
      onDelta,
    );
    expect(onDelta).not.toHaveBeenCalled();
  });
});

describe('acpConfigured', () => {
  it('is false when ACP URL is unset', () => {
    const prev = process.env.THEOREM_ACP_WS_URL;
    delete process.env.THEOREM_ACP_WS_URL;
    try {
      const pack = resolveTheoremPackConfig(fakeConfig({}) as never);
      expect(pack.acpConfigured).toBe(false);
      expect(pack.agentUrl).toBe('https://v2.theoremharness.com');
    } finally {
      if (prev === undefined) delete process.env.THEOREM_ACP_WS_URL;
      else process.env.THEOREM_ACP_WS_URL = prev;
    }
  });

  it('is true when theorem.agentUrl is set', () => {
    const prev = process.env.THEOREM_ACP_WS_URL;
    delete process.env.THEOREM_ACP_WS_URL;
    try {
      const pack = resolveTheoremPackConfig(
        fakeConfig({ agentUrl: 'wss://example/v1/commonplace/acp/ws' }) as never,
      );
      expect(pack.acpConfigured).toBe(true);
      expect(pack.agentUrl).toContain('acp/ws');
    } finally {
      if (prev === undefined) delete process.env.THEOREM_ACP_WS_URL;
      else process.env.THEOREM_ACP_WS_URL = prev;
    }
  });
});
