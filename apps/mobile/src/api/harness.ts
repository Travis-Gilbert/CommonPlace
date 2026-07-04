/**
 * Rooms viewport client: theorem-harness-server REST + SSE.
 * Routes per apps/theorem-harness-server (Theorem repo): unauthenticated JSON,
 * tenant passed explicitly; run on a trusted network or behind a proxy.
 */
import EventSource from 'react-native-sse';

import { readInstanceSettings } from './instance';

export type RoomSummary = {
  room_id: string;
  member_count?: number;
  last_activity_ms?: number | null;
  latest_message?: string | null;
};

export type RoomMessage = {
  job_id?: string;
  actor_id?: string;
  message?: string;
  urgency?: string;
  mentions?: string[];
  metadata?: Record<string, unknown>;
  created_at_ms?: number;
  [k: string]: unknown;
};

async function harnessBase(): Promise<{ base: string; tenant: string; actorId: string } | null> {
  const s = await readInstanceSettings();
  if (!s.harnessUrl) return null;
  return {
    base: s.harnessUrl.replace(/\/$/, ''),
    tenant: s.tenant ?? 'Travis-Gilbert',
    actorId: s.actorId ?? 'mobile',
  };
}

async function harnessGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const cfg = await harnessBase();
  if (!cfg) throw new Error('No harness node configured (set it in Account > Instance)');
  const qs = new URLSearchParams({ tenant: cfg.tenant, ...params }).toString();
  const res = await fetch(`${cfg.base}${path}?${qs}`);
  if (!res.ok) throw new Error(`harness HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const listRooms = () =>
  harnessGet<{ rooms: RoomSummary[]; count: number }>('/harness/rooms').then((d) => d.rooms);

export const fetchRoom = (roomId: string) =>
  harnessGet<{ room: unknown }>(`/harness/rooms/${encodeURIComponent(roomId)}`);

export const fetchPresence = (roomId: string) =>
  harnessGet<{ presence: unknown[]; count: number }>(
    `/harness/rooms/${encodeURIComponent(roomId)}/presence`,
  );

export const fetchIntents = (roomId: string) =>
  harnessGet<{ intents: RoomMessage[]; count: number }>(
    `/harness/rooms/${encodeURIComponent(roomId)}/intents`,
  ).then((d) => d.intents);

export const fetchRecords = (roomId: string, limit = 50) =>
  harnessGet<{ records: RoomMessage[]; count: number }>(
    `/harness/rooms/${encodeURIComponent(roomId)}/records`,
    { limit: String(limit) },
  ).then((d) => d.records);

export async function postRoomMessage(
  roomId: string,
  message: string,
  opts: { urgency?: string; mentions?: string[]; metadata?: Record<string, unknown> } = {},
): Promise<unknown> {
  const cfg = await harnessBase();
  if (!cfg) throw new Error('No harness node configured (set it in Account > Instance)');
  const res = await fetch(`${cfg.base}/harness/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenant_slug: cfg.tenant,
      actor_id: cfg.actorId,
      message,
      urgency: opts.urgency ?? 'info',
      mentions: opts.mentions ?? [],
      metadata: opts.metadata ?? {},
    }),
  });
  if (!res.ok) throw new Error(`harness HTTP ${res.status}`);
  return res.json();
}

/** Approve/deny an approval card by replying with structured metadata. */
export const respondToApproval = (roomId: string, approvalId: string, approve: boolean, note?: string) =>
  postRoomMessage(roomId, note ?? (approve ? 'Approved' : 'Denied'), {
    urgency: 'info',
    metadata: { approval_response: { approval_id: approvalId, approved: approve } },
  });

/** Live tail: SSE stream of RoomMessageEvent. Caller owns close(). */
export async function subscribeRoom(
  roomId: string,
  onEvent: (evt: RoomMessage) => void,
  onError?: (e: unknown) => void,
): Promise<() => void> {
  const cfg = await harnessBase();
  if (!cfg) throw new Error('No harness node configured (set it in Account > Instance)');
  const qs = new URLSearchParams({ tenant: cfg.tenant }).toString();
  const es = new EventSource(`${cfg.base}/harness/rooms/${encodeURIComponent(roomId)}/stream?${qs}`);
  es.addEventListener('message', (event) => {
    if (event.type !== 'message' || !('data' in event) || !event.data) return;
    try {
      onEvent(JSON.parse(event.data as string));
    } catch {
      // non-JSON keepalive frames are expected
    }
  });
  es.addEventListener('error', (e) => onError?.(e));
  return () => es.close();
}

export async function registerPushToken(expoPushToken: string, platform: string): Promise<boolean> {
  const cfg = await harnessBase();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.base}/harness/push/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenant_slug: cfg.tenant,
        actor_id: cfg.actorId,
        expo_push_token: expoPushToken,
        platform,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
