import { describe, it, expect } from 'vitest';
import {
  appendUserMessage,
  appendAssistantPlaceholder,
  applyStageEvent,
  applyToken,
  applyComplete,
  applyError,
  beginToolCall,
  completeToolCall,
  failToolCall,
  toThreadMessageLike,
  createStreamHandlers,
} from './thread-reducer';
import type { WorkMessage } from './types';
import type { TheseusResponse } from '@/lib/theseus-types';

function baseResponse(overrides: Partial<TheseusResponse> = {}): TheseusResponse {
  return {
    query: 'what is entropy',
    mode: 'full',
    confidence: { evidence: 0.9, tension: 0.1, combined: 0.85 },
    sections: [],
    metadata: {} as TheseusResponse['metadata'],
    ...overrides,
  };
}

describe('appendUserMessage', () => {
  it('appends a non-streaming user message with the given text', () => {
    const next = appendUserMessage([], 'hello there');
    expect(next).toHaveLength(1);
    expect(next[0].role).toBe('user');
    expect(next[0].text).toBe('hello there');
    expect(next[0].isStreaming).toBe(false);
    expect(next[0].toolParts).toEqual([]);
  });

  it('preserves prior messages', () => {
    const prior = appendUserMessage([], 'first');
    const next = appendUserMessage(prior, 'second');
    expect(next).toHaveLength(2);
    expect(next[0].text).toBe('first');
    expect(next[1].text).toBe('second');
  });
});

describe('appendAssistantPlaceholder', () => {
  it('appends a streaming assistant message with empty text', () => {
    const next = appendAssistantPlaceholder([], 'assistant-1');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'assistant-1', role: 'assistant', text: '', isStreaming: true });
  });
});

describe('applyStageEvent', () => {
  it('adds a running tool part for a start-only stage', () => {
    const messages = appendAssistantPlaceholder([], 'a1');
    const next = applyStageEvent(messages, 'a1', { name: 'retrieval_start' });
    expect(next[0].toolParts).toHaveLength(1);
    expect(next[0].toolParts[0]).toMatchObject({
      toolCallId: 'a1:retrieval',
      toolName: 'retrieval',
      status: 'running',
    });
  });

  it('updates the matching part to complete with the result payload on the paired stage', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyStageEvent(messages, 'a1', { name: 'retrieval_start' });
    messages = applyStageEvent(messages, 'a1', {
      name: 'retrieval_complete',
      evidence_count: 3,
      confidence: 0.8,
      has_tensions: false,
      has_gaps: false,
      bm25_hits: [],
      sbert_scores: [],
      pagerank_scores: {},
      community_assignments: {},
      tensions: [],
    });
    expect(messages[0].toolParts).toHaveLength(1);
    const part = messages[0].toolParts[0];
    expect(part.status).toBe('complete');
    expect(part.result).toMatchObject({ evidence_count: 3 });
  });

  it('creates a single complete part for one-shot stages with no start pair', () => {
    const messages = appendAssistantPlaceholder([], 'a1');
    const next = applyStageEvent(messages, 'a1', { name: 'objects_loaded', object_count: 5, focal_object_ids: [1, 2] });
    expect(next[0].toolParts).toHaveLength(1);
    expect(next[0].toolParts[0]).toMatchObject({ status: 'complete', result: { object_count: 5, focal_object_ids: [1, 2] } });
  });

  it('does not affect other messages', () => {
    const other: WorkMessage = {
      id: 'u1', role: 'user', text: 'hi', toolParts: [], createdAt: 0, isStreaming: false,
    };
    const messages = appendAssistantPlaceholder([other], 'a1');
    const next = applyStageEvent(messages, 'a1', { name: 'retrieval_start' });
    expect(next[0]).toEqual(other);
  });
});

describe('applyToken', () => {
  it('appends streamed text to the assistant message only', () => {
    let messages = appendUserMessage([], 'hi');
    messages = appendAssistantPlaceholder(messages, 'a1');
    messages = applyToken(messages, 'a1', 'Hel');
    messages = applyToken(messages, 'a1', 'lo');
    expect(messages[1].text).toBe('Hello');
    expect(messages[0].text).toBe('hi');
  });
});

describe('applyComplete', () => {
  it('prefers narrative section content over streamed text', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyToken(messages, 'a1', 'partial stream');
    const result = baseResponse({
      sections: [{ type: 'narrative', content: 'final narrative text' } as TheseusResponse['sections'][number]],
    });
    messages = applyComplete(messages, 'a1', result);
    expect(messages[0].text).toBe('final narrative text');
    expect(messages[0].isStreaming).toBe(false);
  });

  it('falls back to the top-level answer field when no narrative section exists', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    const result = baseResponse({ answer: 'top level answer' });
    messages = applyComplete(messages, 'a1', result);
    expect(messages[0].text).toBe('top level answer');
  });

  it('falls back to streamed text when neither narrative nor answer exist', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyToken(messages, 'a1', 'streamed only');
    messages = applyComplete(messages, 'a1', baseResponse());
    expect(messages[0].text).toBe('streamed only');
  });
});

describe('applyError', () => {
  it('marks the assistant message with the error and stops streaming', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyError(messages, 'a1', 'network down');
    expect(messages[0].isStreaming).toBe(false);
    expect(messages[0].error).toBe('network down');
  });
});

describe('beginToolCall', () => {
  it('adds a running tool part with the given name and args', () => {
    const messages = appendAssistantPlaceholder([], 'a1');
    const next = beginToolCall(messages, 'a1', 'a1:memory_recall', 'memory_recall', { question: 'why?' });
    expect(next[0].toolParts).toHaveLength(1);
    expect(next[0].toolParts[0]).toEqual({
      toolCallId: 'a1:memory_recall',
      toolName: 'memory_recall',
      args: { question: 'why?' },
      status: 'running',
    });
  });
});

describe('completeToolCall', () => {
  it('marks the matching tool part complete with the result and stops streaming', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = beginToolCall(messages, 'a1', 'a1:memory_recall', 'memory_recall', { question: 'why?' });
    messages = completeToolCall(messages, 'a1', 'a1:memory_recall', { answer: 'because' });
    expect(messages[0].isStreaming).toBe(false);
    expect(messages[0].toolParts[0]).toMatchObject({ status: 'complete', result: { answer: 'because' } });
  });

  it('does not touch tool parts with a different toolCallId', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = beginToolCall(messages, 'a1', 'a1:one', 'memory_recall', {});
    messages = beginToolCall(messages, 'a1', 'a1:two', 'coordination_ping', {});
    messages = completeToolCall(messages, 'a1', 'a1:one', 'done');
    expect(messages[0].toolParts[0]).toMatchObject({ toolCallId: 'a1:one', status: 'complete' });
    expect(messages[0].toolParts[1]).toMatchObject({ toolCallId: 'a1:two', status: 'running' });
  });
});

describe('failToolCall', () => {
  it('marks the matching tool part complete with an error result and sets the message error', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = beginToolCall(messages, 'a1', 'a1:memory_recall', 'memory_recall', { question: 'why?' });
    messages = failToolCall(messages, 'a1', 'a1:memory_recall', 'network down');
    expect(messages[0].isStreaming).toBe(false);
    expect(messages[0].error).toBe('network down');
    expect(messages[0].toolParts[0]).toMatchObject({ status: 'complete', result: { error: 'network down' } });
  });
});

describe('toThreadMessageLike', () => {
  it('converts a user message to a text-only content part', () => {
    const [message] = appendUserMessage([], 'hi there');
    const like = toThreadMessageLike(message);
    expect(like.role).toBe('user');
    expect(like.content).toEqual([{ type: 'text', text: 'hi there' }]);
  });

  it('converts an assistant message with tool parts before the trailing text part', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyStageEvent(messages, 'a1', { name: 'retrieval_start' });
    messages = applyToken(messages, 'a1', 'answer text');
    const like = toThreadMessageLike(messages[0]);
    expect(like.role).toBe('assistant');
    expect(like.content).toEqual([
      { type: 'tool-call', toolCallId: 'a1:retrieval', toolName: 'retrieval', args: {}, result: undefined },
      { type: 'text', text: 'answer text' },
    ]);
    expect(like.status).toEqual({ type: 'running' });
  });

  it('reports a complete status once streaming has finished', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyComplete(messages, 'a1', baseResponse({ answer: 'done' }));
    const like = toThreadMessageLike(messages[0]);
    expect(like.status).toEqual({ type: 'complete', reason: 'stop' });
  });

  it('reports an incomplete/error status when the message carries an error', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    messages = applyError(messages, 'a1', 'boom');
    const like = toThreadMessageLike(messages[0]);
    expect(like.status).toEqual({ type: 'incomplete', reason: 'error' });
  });
});

describe('createStreamHandlers', () => {
  it('routes stage/token/complete/error events through the pure reducers via the setter', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    const setMessages = (updater: (messages: readonly WorkMessage[]) => WorkMessage[]) => {
      messages = updater(messages);
    };
    let settled = 0;
    const handlers = createStreamHandlers('a1', setMessages, () => {
      settled += 1;
    });

    handlers.onStage({ name: 'pipeline_start', query: 'q' });
    handlers.onToken('he');
    handlers.onToken('llo');
    expect(messages[0].text).toBe('hello');
    expect(messages[0].toolParts).toHaveLength(1);

    handlers.onComplete(baseResponse({ answer: 'hello world' }));
    expect(messages[0].text).toBe('hello world');
    expect(messages[0].isStreaming).toBe(false);
    expect(settled).toBe(1);
  });

  it('marks the message errored and settles on stream error', () => {
    let messages = appendAssistantPlaceholder([], 'a1');
    const setMessages = (updater: (messages: readonly WorkMessage[]) => WorkMessage[]) => {
      messages = updater(messages);
    };
    let settled = 0;
    const handlers = createStreamHandlers('a1', setMessages, () => {
      settled += 1;
    });

    handlers.onError({ message: 'stream broke', transient: true });
    expect(messages[0].error).toBe('stream broke');
    expect(settled).toBe(1);
  });
});
