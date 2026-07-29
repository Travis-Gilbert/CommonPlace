'use client';

// SOURCING: React useEffect + eventsource-parser (console SSE consumption ledger row).

import { useEffect } from 'react';
import { subscribeRoomEvents, type AgentSpaceEnvelope } from './client';
import { useThreadStore } from '@/lib/thread-store';

interface RoomMessageData {
  readonly message_id: string;
  readonly message: string;
}

function roomMessageFrom(envelope: AgentSpaceEnvelope): RoomMessageData | null {
  if (envelope.event.type !== 'room_message' || !envelope.event.data || typeof envelope.event.data !== 'object') {
    return null;
  }
  const data = envelope.event.data as { message_id?: unknown; message?: unknown };
  if (typeof data.message_id !== 'string' || typeof data.message !== 'string') return null;
  return { message_id: data.message_id, message: data.message };
}

export function useRoomEvents(roomId: string | null | undefined): void {
  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    const unsubscribe = subscribeRoomEvents({
      roomId,
      signal: controller.signal,
      onEnvelope(envelope) {
        const message = roomMessageFrom(envelope);
        if (!message) return;
        useThreadStore.getState().appendRoomMessage(message);
      },
      onError() {
        // The live rail remains available from the last coherent snapshot.
      },
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [roomId]);
}
