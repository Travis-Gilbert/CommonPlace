/** Chat: thread list (Claude-app anatomy). Threads live on-device. */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useSyncExternalStore } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThread, getChatRevision, listThreads, subscribeChat } from '@/chat/threads';
import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import { useTheme } from '@/theme/ThemeProvider';

export default function ChatScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const revision = useSyncExternalStore(subscribeChat, getChatRevision, getChatRevision);
  const threads = useMemo(() => {
    void revision;
    return listThreads();
  }, [revision]);

  const newThread = () => {
    const thread = createThread('New thread');
    router.push({ pathname: '/thread/[id]', params: { id: thread.id } });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display1">Chat</AppText>
      </View>
      <View style={[styles.contextCard, { backgroundColor: t.c.surface }]}>
        <Ionicons name="sparkles-outline" size={18} color={t.speaker.agent} />
        <View style={{ flex: 1 }}>
          <AppText variant="sub">Grounded in your commonplace</AppText>
          <AppText variant="caption" tone="muted">Threads keep their context on this phone.</AppText>
        </View>
      </View>
      <FlatList
        data={threads}
        keyExtractor={(th) => th.id}
        renderItem={({ item: th }) => (
          <PressableSurface
            onPress={() => router.push({ pathname: '/thread/[id]', params: { id: th.id } })}
            style={styles.threadRow}
            pressedStyle={{ backgroundColor: t.c.muted }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="body" numberOfLines={1}>
                {th.title}
              </AppText>
              <AppText variant="caption" tone="faint">
                {new Date(th.updatedAt).toLocaleString()}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
          </PressableSurface>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="sub" tone="muted">
              Ask anything; answers ground in your commonplace.
            </AppText>
          </View>
        }
        contentContainerStyle={{ paddingBottom: t.layout.tabPillHeight + 116 }}
      />
      <PressableSurface
        onPress={newThread}
        accessibilityLabel="New chat"
        style={[
          styles.newChat,
          {
            bottom: t.layout.tabPillHeight + Math.max(insets.bottom, 12) + 16,
            backgroundColor: t.c.text,
            boxShadow: t.contactShadow || undefined,
          },
        ]}
        pressedStyle={{ opacity: 0.84 }}
      >
        <Ionicons name="add" size={22} color={t.c.bg} />
        <AppText variant="headline" style={{ color: t.c.bg }}>New chat</AppText>
      </PressableSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  contextCard: {
    minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 12, borderRadius: 20, paddingHorizontal: 16,
    borderCurve: 'continuous',
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginHorizontal: 4,
  },
  empty: { padding: 48, alignItems: 'center' },
  newChat: {
    position: 'absolute', right: 18, minHeight: 52, flexDirection: 'row', alignItems: 'center',
    gap: 8, borderRadius: 26, paddingHorizontal: 18, borderCurve: 'continuous',
  },
});
