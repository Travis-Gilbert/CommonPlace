/** Chat: thread list (Claude-app anatomy). Threads live on-device. */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useSyncExternalStore } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThread, listThreads, subscribeChat } from '@/chat/threads';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export default function ChatScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const threads = useSyncExternalStore(subscribeChat, listThreads, listThreads);

  const newThread = () => {
    const thread = createThread('New thread');
    router.push({ pathname: '/thread/[id]', params: { id: thread.id } });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display1">Chat</AppText>
        <Pressable
          onPress={newThread}
          accessibilityLabel="New thread"
          style={({ pressed }) => [
            styles.newBtn,
            { backgroundColor: pressed ? t.c.primaryPressed : t.c.primary, borderCurve: 'continuous' },
          ]}
        >
          <Ionicons name="add" size={20} color={t.c.onPrimary} />
        </Pressable>
      </View>
      <FlatList
        data={threads}
        keyExtractor={(th) => th.id}
        renderItem={({ item: th }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/thread/[id]', params: { id: th.id } })}
            style={({ pressed }) => [
              styles.threadRow,
              { backgroundColor: pressed ? t.c.muted : t.c.surface, borderBottomColor: t.c.border },
            ]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.c.textMuted} />
            <View style={{ flex: 1 }}>
              <AppText variant="sub" numberOfLines={1}>
                {th.title}
              </AppText>
              <AppText variant="micro" tone="faint">
                {new Date(th.updatedAt).toLocaleString()}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="sub" tone="muted">
              Ask anything; answers ground in your commonplace.
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
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { padding: 48, alignItems: 'center' },
});
