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

function controlledSseResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  return {
    response,
    send(event: string) {
      controller?.enqueue(encoder.encode(event));
    },
    close() {
      controller?.close();
    },
  };
}

describe('thread store', () => {
  beforeEach(() => {
    useThreadStore.setState({
      messages: [],
      isRunning: false,
      error: null,
      abort: null,
      endpoint: 'http://fixture/chat',
      mode: 'auto',
      plan: [],
      staged: [],
    });
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
    expect(state.messages[1].parts).toEqual([
      { type: 'text', text: 'The proof workspace answers.' },
    ]);
  });

  it('keeps acknowledgement, truthful activity, and response in one ordered turn', async () => {
    const stream = controlledSseResponse();
    vi.stubGlobal('fetch', vi.fn(async () => stream.response));

    const sending = useThreadStore.getState().send('Explain this result');
    await vi.waitFor(() => expect(useThreadStore.getState().isRunning).toBe(true));
    stream.send('event: turn_prelude\ndata: {"acknowledgement":"I will trace the result through its proof obligations."}\n\n');
    stream.send('event: turn_prelude\ndata: {"acknowledgement":"I will trace the result through its proof obligations."}\n\n');
    stream.send('event: activity\ndata: {"status":"running"}\n\n');
    stream.send('data: {"delta":"The result follows from the admitted evidence."}\n\n');

    await vi.waitFor(() => expect(useThreadStore.getState().messages[1].parts).toEqual([
      {
        type: 'data',
        name: 'theorem-acknowledgement',
        data: { text: 'I will trace the result through its proof obligations.' },
      },
      { type: 'data', name: 'theorem-activity', data: { status: 'running' } },
      { type: 'text', text: 'The result follows from the admitted evidence.' },
    ]));

    stream.send('event: done\ndata: {}\n\n');
    stream.close();
    await sending;
    expect(useThreadStore.getState().messages[1].parts).toEqual([
      {
        type: 'data',
        name: 'theorem-acknowledgement',
        data: { text: 'I will trace the result through its proof obligations.' },
      },
      { type: 'text', text: 'The result follows from the admitted evidence.' },
    ]);
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

  it('ignores stale activity and text after a terminal event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([
        'event: turn_prelude\ndata: {"acknowledgement":"I will inspect the terminal ordering."}\n\n',
        'event: done\ndata: {}\n\n',
        'event: activity\ndata: {"status":"running"}\n\n',
        'data: {"delta":"stale answer"}\n\n',
      ])),
    );

    await useThreadStore.getState().send('Check terminal ordering');

    expect(useThreadStore.getState().messages[1].parts).toEqual([{
      type: 'data',
      name: 'theorem-acknowledgement',
      data: { text: 'I will inspect the terminal ordering.' },
    }]);
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
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({ capability: { kind: 'web' } });
  });

  it('uses Auto by default and sends explicit Theorem only when selected', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => sseResponse([]));
    vi.stubGlobal('fetch', fetchSpy);

    await useThreadStore.getState().send('Route this automatically');
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).not.toHaveProperty('capability');

    useThreadStore.getState().setMode('theorem');
    await useThreadStore.getState().send('Keep this in Theorem');
    expect(JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body))).toMatchObject({
      capability: { kind: 'theorem' },
    });
  });
});
