// SOURCING: none. Wire contract tests (HANDOFF-CONSOLE-ROUND-2 R2/R5): one
// per wire, each deserializing a payload in the exact shape the backend
// emits. The object-seam fixture mirrors the Rust serde field names from
// crates/commonplace/src/block_view.rs (verified against source; a live
// capture replaces these bytes when the stack is up, and the shapes are
// asserted so any drift fails here first). The chat fixture mirrors the
// bridge's TheoremAgentState snapshot frames from packages/theorem-acp.

import { describe, expect, it } from 'vitest';
import { HttpBlockHost } from '@commonplace/block-view/host/http';
import type { TheoremAgentState } from '@commonplace/theorem-acp/state';
import { deltaStream, readChatRequest, requireMobileApiKey } from './chat-delta';

// The captured object-seam response shape (POST /objects/query). Field names
// are the serde renames on the wire: `type` (not type_ref), `where` (not
// where_clause), snake_case next_cursor, singular note.
const OBJECT_SET_CAPTURE = {
  objects: [
    {
      id: 'rec-1',
      type: 'record',
      properties: { title: 'Recall trace 1', status: 'open', updated: '2026-05-11' },
      relations: {},
      axes: { embeddable: false },
    },
  ],
  shape: {
    types: ['record'],
    fields: ['title', 'status', 'updated'],
    relations: [],
    axes: {},
    cardinality: 'one',
  },
  next_cursor: '50',
  note: 'served from the durable store',
};

describe('object seam wire contract (R2.1)', () => {
  it('deserializes the Rust ObjectSet shape and maps note to notes', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(OBJECT_SET_CAPTURE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const statuses: (number | null)[] = [];
      // The console base is /api; the host appends /objects/query itself.
      const host = new HttpBlockHost({ baseUrl: '/api', onStatus: (s) => statuses.push(s) });
      const set = await host.query({
        types: ['record'],
        where: { kind: 'eq', field: 'status', value: 'open' },
        rank: [{ kind: 'field', field: 'updated', direction: 'desc' }],
        page: { limit: 50 },
        live: true,
      });
      // Request rides the wire names the Rust serde layer expects.
      expect(calls[0].url).toBe('/api/objects/query');
      const body = calls[0].body as Record<string, unknown>;
      expect(body.where).toEqual({ kind: 'eq', field: 'status', value: 'open' });
      expect(body.rank).toEqual([{ kind: 'field', field: 'updated', direction: 'desc' }]);
      expect(body.page).toEqual({ limit: 50 });
      // Response adapts to the client contract.
      expect(set.objects[0].properties.title).toBe('Recall trace 1');
      expect(set.shape.cardinality).toBe('one');
      expect(set.next_cursor).toBe('50');
      expect(set.notes).toEqual(['served from the durable store']);
      expect(statuses).toEqual([200]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports identity refusal (403) through the transport observer', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })) as typeof fetch;
    try {
      const statuses: (number | null)[] = [];
      const host = new HttpBlockHost({ baseUrl: '/api', onStatus: (s) => statuses.push(s) });
      await expect(host.query({ types: ['record'] })).rejects.toThrow('403');
      expect(statuses).toEqual([403]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// The captured chat-wire snapshots: the bridge emits cumulative
// TheoremAgentState values; the adapter must flatten them to deltas.
function snapshot(text: string, turnStatus: TheoremAgentState['turnStatus']): TheoremAgentState {
  return {
    sessionId: 'sess-1',
    mode: 'composed',
    bindingId: 'agent:theorem',
    turnStatus,
    activityStatus: turnStatus === 'running' ? 'running' : 'completed',
    messages: [
      { id: 'm1', role: 'user', text: 'hello', acknowledgement: null, contributions: [], toolCalls: [] },
      { id: 'm2', role: 'assistant', text, acknowledgement: null, contributions: [], toolCalls: [] },
    ],
    pendingPermission: null,
    blockedReason: null,
    error: null,
    appliedUpdateKeys: [],
  };
}

async function collectFrames(states: TheoremAgentState[]): Promise<string> {
  const holder: { listener: ((state: TheoremAgentState) => void) | null } = { listener: null };
  const stream = deltaStream(
    (callback) => {
      holder.listener = callback;
      return () => {
        holder.listener = null;
      };
    },
    states[0],
    new AbortController().signal,
  );
  for (const state of states.slice(1)) holder.listener?.(state);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe('chat wire contract (R2.2)', () => {
  it('preserves display text while grounding the ACP prompt in an exact capability', () => {
    const request = readChatRequest({
      content: [{ type: 'text', text: 'Review this change.' }],
      capability: { kind: 'plugin', id: 'review-plugin', name: 'Review plugin' },
    });

    expect(request.displayText).toBe('Review this change.');
    expect(request.promptText).toContain('id "review-plugin"');
    expect(request.promptText).toContain('name "Review plugin"');
    expect(request.promptText).toContain('User request:\nReview this change.');
  });

  it('rejects malformed capability selection instead of treating it as prose', () => {
    expect(() => readChatRequest({
      content: [{ type: 'text', text: 'Review this change.' }],
      capability: { kind: 'skill', id: '', name: 'Review' },
    })).toThrow('Expected a valid chat capability.');
  });

  it('grounds an advertised web-search turn while retaining the user-visible text', () => {
    const request = readChatRequest({
      content: [{ type: 'text', text: 'What changed in Rust this week?' }],
      capability: { kind: 'web' },
    });

    expect(request.displayText).toBe('What changed in Rust this week?');
    expect(request.promptText).toContain('supplied live web research evidence');
    expect(request.promptText).toContain('cite its exact source URLs');
  });

  it('accepts an explicit Theorem destination separately from Auto', () => {
    const request = readChatRequest({
      content: [{ type: 'text', text: 'Explain this result.' }],
      capability: { kind: 'theorem' },
    });

    expect(request.capability).toEqual({ kind: 'theorem' });
    expect(request.promptText).toContain('composed Theorem agent');
  });

  it('optionally protects the mobile route with the instance api key', () => {
    expect(() => requireMobileApiKey(
      new Request('https://example.test/api/chat/stream', { headers: { 'x-api-key': 'right-key' } }),
      'right-key',
    )).not.toThrow();
    expect(() => requireMobileApiKey(
      new Request('https://example.test/api/chat/stream'),
      'right-key',
    )).toThrow('The mobile API key was refused.');
  });

  it('flattens cumulative snapshots into incremental delta frames', async () => {
    const frames = await collectFrames([
      snapshot('The', 'running'),
      snapshot('The harness', 'running'),
      snapshot('The harness answers.', 'complete'),
    ]);
    const deltas = [...frames.matchAll(/data: (\{.*\})/g)]
      .map((match) => JSON.parse(match[1]) as { delta?: string })
      .filter((frame) => typeof frame.delta === 'string');
    expect(deltas).toEqual([
      { delta: 'The' },
      { delta: ' harness' },
      { delta: ' answers.' },
    ]);
    expect(frames).toContain('event: done');
    expect(frames).toContain('event: activity');
    // The console parser treats unnamed data events as message deltas; no
    // update-state envelope and no [DONE] sentinel may leak through.
    expect(frames).not.toContain('update-state');
    expect(frames).not.toContain('[DONE]');
  });

  it('surfaces refused turns as named error events, never fake replies', async () => {
    const refused = { ...snapshot('', 'refused'), blockedReason: 'principal_resolution=unauthenticated' };
    const frames = await collectFrames([refused]);
    expect(frames).toContain('event: error');
    expect(frames).toContain('principal_resolution=unauthenticated');
  });
});
