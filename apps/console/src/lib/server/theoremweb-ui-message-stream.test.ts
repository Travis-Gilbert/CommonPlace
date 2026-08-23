import { describe, expect, it, vi } from 'vitest';
import type { AcquiredAcpSession } from '@commonplace/theorem-acp/session-manager';
import type { TheoremAgentState } from '@commonplace/theorem-acp/state';
import {
  createTheoremUiMessageStream,
  theoremUiMessageStreamHeaders,
} from './theoremweb-ui-message-stream';

function state(overrides: Partial<TheoremAgentState> = {}): TheoremAgentState {
  return {
    sessionId: 'session-live-1',
    mode: 'composed',
    bindingId: 'agent:theorem',
    turnStatus: 'idle',
    activityStatus: null,
    messages: [],
    pendingPermission: null,
    blockedReason: null,
    bootBrief: null,
    error: null,
    appliedUpdateKeys: [],
    ...overrides,
  };
}

function fakeSession(initial: TheoremAgentState) {
  let current = initial;
  const listeners = new Set<(value: TheoremAgentState) => void>();
  const session = {
    sessionId: 'session-live-1',
    getState: () => current,
    subscribe: (listener: (value: TheoremAgentState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancel: vi.fn(async () => {}),
  } as unknown as AcquiredAcpSession;
  return {
    session,
    publish(next: TheoremAgentState) {
      current = next;
      listeners.forEach((listener) => listener(next));
    },
  };
}

function partsFromSse(document: string): Array<Record<string, unknown>> {
  return document
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('Theorem UI-message stream', () => {
  it('adapts real cumulative ACP state without duplicating deltas', async () => {
    const managed = fakeSession(state());
    const response = new Response(createTheoremUiMessageStream({
      session: managed.session,
      sources: [{
        title: 'Primary source',
        url: 'https://example.test/primary',
        snippet: 'Evidence',
        provider: 'RustyWeb',
      }],
      signal: new AbortController().signal,
      tenant: 'tenant-a',
      start: async () => {
        managed.publish(state({
          turnStatus: 'running',
          activityStatus: 'running',
          messages: [{
            id: 'assistant-1',
            role: 'assistant',
            text: 'Hello',
            acknowledgement: null,
            contributions: [{ headId: 'head-a', summary: 'Inspect graph', at: 1 }],
            toolCalls: [{
              callId: 'call-1',
              name: 'write_file',
              rawInput: { path: 'note.md' },
              status: 'pending',
            }],
          }],
        }));
        managed.publish(state({
          turnStatus: 'running',
          activityStatus: 'running',
          messages: [{
            id: 'assistant-1',
            role: 'assistant',
            text: 'Hello world',
            acknowledgement: null,
            contributions: [{ headId: 'head-a', summary: 'Inspect graph', at: 1 }],
            toolCalls: [{
              callId: 'call-1',
              name: 'write_file',
              rawInput: { path: 'note.md' },
              status: 'pending',
            }],
          }],
          pendingPermission: {
            callId: 'call-1',
            name: 'write_file',
            rawInput: { path: 'note.md' },
          },
        }));
      },
    }));

    const parts = partsFromSse(await response.text());
    const types = parts.map((part) => part.type);
    expect(types).toContain('text-delta');
    expect(types).toContain('reasoning-delta');
    expect(types).toContain('tool-input-available');
    expect(types).toContain('tool-approval-request');
    expect(types).toContain('source-url');
    expect(types).toContain('data-theorem-run');
    expect(parts.filter((part) => part.type === 'tool-input-available')).toHaveLength(1);
    expect(parts.filter((part) => part.type === 'text-delta').map((part) => part.delta))
      .toEqual(['Hello', ' world']);
    expect(parts.find((part) => part.type === 'finish')).toMatchObject({
      finishReason: 'tool-calls',
    });
  });

  it('sets the AI SDK protocol response header', () => {
    expect(theoremUiMessageStreamHeaders().get('x-vercel-ai-ui-message-stream')).toBe('v1');
  });
});
