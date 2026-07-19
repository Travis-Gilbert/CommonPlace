import { describe, expect, it } from 'vitest';
import { beginTurn, createTheoremAgentState, type TheoremAgentState } from '@commonplace/theorem-acp/state';
import { proactivityCompilationStream } from './compilation-stream';

describe('proactivity compilation stream', () => {
  it('reduces ACP state snapshots into a pending-review event', async () => {
    let listener: ((state: TheoremAgentState) => void) | null = null;
    const initial = beginTurn(createTheoremAgentState({ mode: 'composed', bindingId: 'agent:theorem' }), 'compile');
    const stream = proactivityCompilationStream(
      (next) => {
        listener = next;
        return () => { listener = null; };
      },
      initial,
      new AbortController().signal,
      async (text) => {
        expect(text).toBe('{"candidates":[]}');
        return {
          id: 'compilation-1',
          candidates: [{ kind: 'watch', label: 'Watch for appeal changes.' }],
        };
      },
    );
    const completed: TheoremAgentState = {
      ...initial,
      turnStatus: 'complete',
      messages: initial.messages.map((message) => message.role === 'assistant'
        ? { ...message, text: '{"candidates":[]}' }
        : message),
    };
    const emit = listener as ((state: TheoremAgentState) => void) | null;
    expect(emit).not.toBeNull();
    emit!(completed);

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
    }
    expect(output).toContain('"delta":"{\\"candidates\\":[]}"');
    expect(output).toContain('event: compilation');
    expect(output).toContain('"id":"compilation-1"');
    expect(output).toContain('event: done');
  });
});
