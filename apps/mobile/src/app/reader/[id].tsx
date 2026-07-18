import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { objectTheoremUri } from '@/addressing/theoremUri';
import { fetchItem } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { cacheReaderDocument, readCachedDocument } from '@/reader/cache';
import { useTheme } from '@/theme/ThemeProvider';

export default function ReaderScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id!;
  const cached = readCachedDocument(itemId);
  const item = useQuery({ queryKey: ['reader', itemId], queryFn: () => fetchItem(itemId), initialData: cached, retry: 1 });

  useEffect(() => {
    if (item.data) cacheReaderDocument(item.data);
  }, [item.data]);

  async function shareDocument() {
    if (!item.data) return;
    const url = await objectTheoremUri({ id: item.data.id, kind: item.data.kind });
    await Share.share({ message: `${item.data.title}\n${url}`, url });
  }

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6, borderBottomColor: t.c.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12}><Ionicons name="chevron-back" size={24} color={t.c.text} /></Pressable>
        <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>READER</AppText>
        <Pressable onPress={() => void shareDocument()} accessibilityLabel="Share theorem address" hitSlop={12}><Ionicons name="share-outline" size={20} color={t.c.textMuted} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!item.data ? <AppText variant="sub" tone="muted">{item.isLoading ? 'Opening document...' : 'This document is not cached and the node is unavailable.'}</AppText> : (
          <>
            <AppText variant="display1" style={{ fontFamily: t.speakerFonts.human, color: t.speaker.human }}>{item.data.title}</AppText>
            <View style={styles.meta}>
              <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>{item.data.kind}</AppText>
              {cached && item.isFetching ? <AppText variant="micro" style={{ color: t.speaker.memory, fontFamily: t.speakerFonts.machine }}>CACHED · REFRESHING</AppText> : null}
            </View>
            <AppText variant="body" style={{ fontFamily: t.speakerFonts.human, fontSize: 19, lineHeight: 30 }}>
              {item.data.bodyText || 'This document has no projected body text.'}
            </AppText>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingBottom: 10 },
  body: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 70, gap: 16, maxWidth: 720, alignSelf: 'center', width: '100%' },
  meta: { flexDirection: 'row', gap: 10 },
});
