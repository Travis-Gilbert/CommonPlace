/**
 * One room: the feed (intents, messages, records, receipts) on an umber
 * machine surface, live via SSE, with a docked composer (@-mentions heads,
 * optional Wake delivery as the hand-off action). Approval requests render as
 * inline cards with Approve and Deny. Read + message + approve; no run
 * spawning UI in v1 (D4).
 */
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchIntents,
  fetchPresence,
  fetchRecords,
  postRoomMessage,
  respondToApproval,
  subscribeRoom,
  type RoomMessage,
} from '@/api/harness';
import { AppText } from '@/components/AppText';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import { useTheme } from '@/theme/ThemeProvider';

type FeedEntry = RoomMessage & { _feedKind: 'intent' | 'record' | 'live' };

function entryTime(e: RoomMessage): number {
  const cands = [e.created_at_ms, (e as Record<string, unknown>).updated_at_ms, (e as Record<string, unknown>).ts_ms];
  for (const c of cands) if (typeof c === 'number') return c;
  return 0;
}

function approvalOf(e: RoomMessage): { id: string; summary: string } | null {
  const meta = e.metadata as Record<string, unknown> | undefined;
  const approval = meta?.approval as Record<string, unknown> | undefined;
  if (!approval) return null;
  return {
    id: (approval.id as string) ?? (e.job_id as string) ?? 'approval',
    summary: (approval.summary as string) ?? (e.message as string) ?? 'Approval requested',
  };
}

export default function RoomScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = id!;
  const [live, setLive] = useState<FeedEntry[]>([]);
  const [text, setText] = useState('');
  const [wake, setWake] = useState(false);
  const [responded, setResponded] = useState<Record<string, 'approved' | 'denied'>>({});

  const intents = useQuery({ queryKey: ['room-intents', roomId], queryFn: () => fetchIntents(roomId), retry: 1 });
  const records = useQuery({ queryKey: ['room-records', roomId], queryFn: () => fetchRecords(roomId), retry: 1 });
  const presence = useQuery({ queryKey: ['room-presence', roomId], queryFn: () => fetchPresence(roomId), retry: 1 });

  useEffect(() => {
    let close: (() => void) | null = null;
    let cancelled = false;
    subscribeRoom(roomId, (evt) => setLive((xs) => [...xs, { ...evt, _feedKind: 'live' }]))
      .then((c) => {
        if (cancelled) c();
        else close = c;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      close?.();
    };
  }, [roomId]);

  const feed = useMemo<FeedEntry[]>(() => {
    const rows: FeedEntry[] = [
      ...(intents.data ?? []).map((e) => ({ ...e, _feedKind: 'intent' as const })),
      ...(records.data ?? []).map((e) => ({ ...e, _feedKind: 'record' as const })),
      ...live,
    ];
    rows.sort((a, b) => entryTime(a) - entryTime(b));
    return rows;
  }, [intents.data, records.data, live]);

  const actors = useMemo(() => {
    const list = (presence.data?.presence ?? []) as { actor_id?: string }[];
    return list.map((p) => p.actor_id).filter(Boolean) as string[];
  }, [presence.data]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    const mentions = [...body.matchAll(/@([\w-]+)/g)].map((m) => m[1]);
    try {
      await postRoomMessage(roomId, body, {
        mentions,
        metadata: wake ? { delivery: 'wake' } : {},
      });
      void qc.invalidateQueries({ queryKey: ['room-records', roomId] });
    } catch {
      setText(body); // do not lose the message
    }
  }

  async function decide(entry: FeedEntry, approve: boolean) {
    const approval = approvalOf(entry)!;
    setResponded((r) => ({ ...r, [approval.id]: approve ? 'approved' : 'denied' }));
    try {
      await respondToApproval(roomId, approval.id, approve);
    } catch {
      setResponded((r) => {
        const { [approval.id]: _, ...rest } = r;
        return rest;
      });
    }
  }

  const renderEntry = ({ item: entry }: { item: FeedEntry }) => {
    const approval = approvalOf(entry);
    const actor = (entry.actor_id as string) ?? 'head';
    const body =
      (entry.message as string) ??
      ((entry as Record<string, unknown>).summary as string) ??
      ((entry as Record<string, unknown>).description as string) ??
      JSON.stringify(entry).slice(0, 160);
    if (approval) {
      const decision = responded[approval.id];
      return (
        <View style={[styles.approvalCard, { backgroundColor: t.machine.raise, borderColor: t.c.primary, borderCurve: 'continuous' }]}>
          <View style={styles.entryHead}>
            <Ionicons name="shield-checkmark-outline" size={14} color={t.c.primary} />
            <AppText variant="micro" style={{ color: t.accents.goldLight }}>
              {actor} requests approval
            </AppText>
          </View>
          <AppText variant="sub" tone="machine">
            {approval.summary}
          </AppText>
          {decision ? (
            <AppText variant="caption" style={{ color: decision === 'approved' ? t.accents.green : t.machine.muted }}>
              {decision === 'approved' ? 'Approved' : 'Denied'}
            </AppText>
          ) : (
            <View style={styles.approvalActions}>
              <Pressable
                onPress={() => void decide(entry, true)}
                style={({ pressed }) => [
                  styles.approvalBtn,
                  { backgroundColor: pressed ? t.c.primaryPressed : t.c.primary, borderCurve: 'continuous' },
                ]}
              >
                <AppText variant="caption" tone="onPrimary">
                  Approve
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => void decide(entry, false)}
                style={({ pressed }) => [
                  styles.approvalBtn,
                  {
                    backgroundColor: pressed ? t.machine.mid : 'transparent',
                    borderWidth: 1,
                    borderColor: t.machine.line,
                    borderCurve: 'continuous',
                  },
                ]}
              >
                <AppText variant="caption" tone="machine">
                  Deny
                </AppText>
              </Pressable>
            </View>
          )}
        </View>
      );
    }
    return (
      <View style={[styles.entry, { borderBottomColor: t.machine.line }]}>
        <View style={styles.entryHead}>
          <AppText variant="micro" style={{ color: t.accents.goldLight }}>
            {actor}
          </AppText>
          <AppText variant="micro" tone="machineMuted">
            {entry._feedKind}
            {entry.urgency && entry.urgency !== 'info' ? ` : ${entry.urgency}` : ''}
          </AppText>
        </View>
        <AppText variant="sub" tone="machine">
          {body}
        </AppText>
      </View>
    );
  };

  const loading = intents.isLoading && records.isLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.machine.ground }]}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 6, borderBottomColor: t.machine.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={t.machine.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" tone="machine" numberOfLines={1}>
            {roomId}
          </AppText>
          {actors.length ? (
            <AppText variant="micro" tone="machineMuted" numberOfLines={1}>
              {actors.join(', ')}
            </AppText>
          ) : null}
        </View>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <WeaveSpinner size={120} color={t.accents.goldLight} />
        </View>
      ) : (
        <FlashList
          data={feed}
          keyExtractor={(e, i) => `${e.job_id ?? 'e'}-${i}`}
          renderItem={renderEntry}
          contentContainerStyle={styles.feed}
          ListEmptyComponent={
            <View style={styles.loading}>
              <AppText variant="sub" tone="machineMuted">
                {intents.isError && records.isError ? 'Node unreachable.' : 'Quiet room.'}
              </AppText>
            </View>
          }
        />
      )}
      <View
        style={[
          styles.composer,
          { borderTopColor: t.machine.line, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: t.machine.mid },
        ]}
      >
        <Pressable
          onPress={() => setWake((w) => !w)}
          accessibilityLabel="Wake a head with this message"
          hitSlop={8}
          style={styles.wakeBtn}
        >
          <Ionicons name={wake ? 'flash' : 'flash-outline'} size={20} color={wake ? t.accents.goldLight : t.machine.muted} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={wake ? 'Hand off to a head...' : 'Message the room, @ a head'}
          placeholderTextColor={t.machine.muted}
          multiline
          style={[styles.input, { color: t.machine.text, backgroundColor: t.machine.raise, borderCurve: 'continuous' }]}
          maxFontSizeMultiplier={1.4}
        />
        <Pressable
          onPress={() => void send()}
          accessibilityLabel="Send"
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: pressed ? t.c.primaryPressed : t.c.primary, borderCurve: 'continuous' },
          ]}
        >
          <Ionicons name="arrow-up" size={18} color={t.c.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  feed: { padding: 16, gap: 4 },
  entry: { paddingVertical: 10, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvalCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 8, gap: 8 },
  approvalActions: { flexDirection: 'row', gap: 10 },
  approvalBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  wakeBtn: { paddingBottom: 9 },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
});
