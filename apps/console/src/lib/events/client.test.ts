// SOURCING: eventsource-parser (console SSE consumption ledger row).

import { describe, expect, it, vi } from 'vitest';
import { subscribeRoomEvents } from './client';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('subscribeRoomEvents', () => {
  it('tails only envelopes newer than the snapshot cursor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ epoch: 7, seq: 2, state: {} }))
      .mockResolvedValueOnce(sseResponse([
        ': epoch:7\n\n',
        'event: room_message\ndata: {"seq":2,"tenant_slug":"Travis-Gilbert","room_id":"room:1","event":{"type":"room_message","data":{"message":"old"}}}\n\n',
        'event: room_message\ndata: {"seq":3,"tenant_slug":"Travis-Gilbert","room_id":"room:1","event":{"type":"room_message","data":{"message":"new"}}}\n\n',
      ]));
    vi.stubGlobal('fetch', fetchMock);

    const envelope = await new Promise<{ seq: number }>((resolve, reject) => {
      subscribeRoomEvents({
        roomId: 'room:1',
        onEnvelope: resolve,
        onError: reject,
      });
    });

    expect(envelope.seq).toBe(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/events/snapshot?room=room%3A1');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/events/stream?room=room%3A1&cursor=2&epoch=7');
  });

  it('re-snapshots after an epoch mismatch before resuming the stream', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ epoch: 7, seq: 2, state: {} }))
      .mockResolvedValueOnce(sseResponse([
        'event: error\ndata: {"condition":"event_epoch_mismatch","epoch":8}\n\n',
      ]))
      .mockResolvedValueOnce(jsonResponse({ epoch: 8, seq: 5, state: {} }))
      .mockResolvedValueOnce(sseResponse([
        ': epoch:8\n\n',
        'event: room_message\ndata: {"seq":6,"tenant_slug":"Travis-Gilbert","room_id":"room:1","event":{"type":"room_message","data":{"message":"resumed"}}}\n\n',
      ]));
    vi.stubGlobal('fetch', fetchMock);

    const envelope = await new Promise<{ seq: number }>((resolve, reject) => {
      subscribeRoomEvents({
        roomId: 'room:1',
        onEnvelope: resolve,
        onError: reject,
      });
    });

    expect(envelope.seq).toBe(6);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/events/snapshot?room=room%3A1');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/events/stream?room=room%3A1&cursor=5&epoch=8');
  });
});
