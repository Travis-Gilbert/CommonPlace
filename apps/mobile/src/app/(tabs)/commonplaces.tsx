/**
 * Commonplaces: the rooms viewport. Room list with presence and latest
 * activity; tap opens the feed. Same object as desktop; works against local or
 * cloud nodes identically (harnessUrl in Account > Instance).
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listRooms } from '@/api/harness';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export default function CommonplacesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: listRooms, refetchInterval: 30_000, retry: 1 });

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display1">Commonplaces</AppText>
      </View>
      <FlatList
        data={rooms.data ?? []}
        keyExtractor={(r) => r.room_id}
        refreshing={rooms.isFetching}
        onRefresh={() => void rooms.refetch()}
        renderItem={({ item: room }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.room_id } })}
            style={({ pressed }) => [
              styles.roomRow,
              { backgroundColor: pressed ? t.c.muted : t.c.surface, borderBottomColor: t.c.border },
            ]}
          >
            <View style={[styles.roomIcon, { backgroundColor: t.machine.mid, borderCurve: 'continuous' }]}>
              <Ionicons
                name={room.room_id.startsWith('repo:') ? 'git-branch-outline' : 'people-outline'}
                size={16}
                color={t.machine.text}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="sub" numberOfLines={1}>
                {room.room_id}
              </AppText>
              {room.latest_message ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {room.latest_message}
                </AppText>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              {typeof room.member_count === 'number' && room.member_count > 0 ? (
                <View style={styles.presenceRow}>
                  <View style={[styles.presenceDot, { backgroundColor: t.accents.green }]} />
                  <AppText variant="micro" tone="faint">
                    {room.member_count === 1 ? '1 head' : `${room.member_count} heads`}
                  </AppText>
                </View>
              ) : null}
              {room.last_activity_ms ? (
                <AppText variant="micro" tone="faint">
                  {new Date(room.last_activity_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="sub" tone="muted" style={{ textAlign: 'center' }}>
              {rooms.isError
                ? 'No harness node reachable. Set the node URL under Account > Instance.'
                : rooms.isLoading
                  ? 'Reaching the node...'
                  : 'No rooms yet.'}
            </AppText>
          </View>
        }
        contentContainerStyle={{ paddingBottom: t.layout.tabPillHeight + 48 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { paddingHorizontal: 16, paddingBottom: 8 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roomIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  presenceDot: { width: 6, height: 6, borderRadius: 3 },
  empty: { padding: 48, alignItems: 'center' },
});
