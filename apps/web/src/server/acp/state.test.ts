import { describe, expect, it } from 'vitest';
import {
  applySessionUpdate,
  beginTurn,
  completeTurn,
  createTheoremAgentState,
} from './state';

describe('ACP state projector', () => {
  it('keeps composed contributions structured and synthesis text separate', () => {
    let state = beginTurn(createTheoremAgentState({ mode: 'composed', bindingId: 'agent:theorem' }), 'help');
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: '[deepseek] inspect the repository' },
    });
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: '[minimax] compare the API contract' },
    });
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'The implementation should use ACP.' },
    });

    const assistant = state.messages.at(-1)!;
    expect(assistant.contributions.map((contribution) => contribution.headId)).toEqual(['deepseek', 'minimax']);
    expect(assistant.text).toBe('The implementation should use ACP.');
  });

  it('accepts legacy double-nested content blocks', () => {
    let state = beginTurn(createTheoremAgentState({ mode: 'single', bindingId: null }), 'help');
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_message_chunk',
      content: { content: { type: 'text', text: 'legacy shape' } },
    });
    expect(state.messages.at(-1)?.text).toBe('legacy shape');
  });

  it('keeps unattributed thoughts and makes tool updates idempotent', () => {
    let state = beginTurn(createTheoremAgentState({ mode: 'single', bindingId: null }), 'help');
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'inspect the repository' },
    });
    state = applySessionUpdate(state, {
      sessionUpdate: 'tool_call',
      toolCallId: 'call-1',
      title: 'read_file',
      rawInput: { path: 'README.md' },
    });
    const update = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call-1',
      status: 'completed',
      rawOutput: 'contents',
    } as const;
    state = applySessionUpdate(state, update);
    state = applySessionUpdate(state, update);

    const assistant = state.messages.at(-1)!;
    expect(assistant.contributions[0]?.headId).toBe('unattributed');
    expect(assistant.toolCalls).toEqual([
      {
        callId: 'call-1',
        name: 'read_file',
        rawInput: { path: 'README.md' },
        rawOutput: 'contents',
        status: 'completed',
      },
    ]);
  });

  it('ignores tool calls without an ACP call identifier', () => {
    let state = beginTurn(createTheoremAgentState({ mode: 'single', bindingId: null }), 'help');
    state = applySessionUpdate(state, {
      sessionUpdate: 'tool_call',
      title: 'read_file',
      rawInput: { path: 'README.md' },
    });

    expect(state.messages.at(-1)?.toolCalls).toEqual([]);
  });

  it('keeps a blocked reason out of assistant prose', () => {
    let state = beginTurn(createTheoremAgentState({ mode: 'composed', bindingId: 'agent:theorem' }), 'help');
    state = applySessionUpdate(state, {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'composed run blocked: policy conflict' },
    });
    state = completeTurn(state, 'refusal');

    expect(state.turnStatus).toBe('refused');
    expect(state.blockedReason).toBe('policy conflict');
    expect(state.messages.at(-1)?.text).toBe('');
  });
});
