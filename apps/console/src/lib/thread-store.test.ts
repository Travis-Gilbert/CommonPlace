// SOURCING: none. Pure logic, no upstream component applies.
// The thread wire, tested against a fixture stream: SSE deltas reduce into
// the assistant message, isRunning tracks the live run (the run widget and
// the mark bind to it), and errors surface without theater.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThreadStore } from './thread-store';

function sseResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('thread store', () => {
  beforeEach(() => {
    useThreadStore.setState({ messages: [], isRunning: false, error: null, abort: null, endpoint: 'http://fixture/chat', mode: 'theorem' });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reduces text deltas into the assistant message and settles isRunning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'event: text_delta\ndata: {"text":"The proof "}\n\n',
          'event: text_delta\ndata: {"text":"workspace answers."}\n\n',
          'event: message_stop\ndata: {}\n\n',
        ]),
      ),
    );
    await useThreadStore.getState().send('What is this?');
    const state = useThreadStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.error).toBeNull();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[1].role).toBe('assistant');
    expect(state.messages[1].parts[0].text).toBe('The proof workspace answers.');
  });

  it('surfaces stream errors as text, never fake progress', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(['event: error\ndata: {"error":"backend down"}\n\n'])),
    );
    await useThreadStore.getState().send('hello');
    const state = useThreadStore.getState();
    expect(state.error).toBe('backend down');
    expect(state.isRunning).toBe(false);
  });

  it('does nothing without a configured endpoint', async () => {
    useThreadStore.setState({ endpoint: null });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await useThreadStore.getState().send('hello');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useThreadStore.getState().messages).toHaveLength(0);
  });

  it('sends the selected web-search capability on the wire', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => sseResponse([]));
    vi.stubGlobal('fetch', fetchSpy);
    useThreadStore.getState().setMode('web');
    await useThreadStore.getState().send('Research this change');
    const payloads = fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(payloads).toContainEqual(expect.objectContaining({ capability: { kind: 'web' } }));
  });
});
