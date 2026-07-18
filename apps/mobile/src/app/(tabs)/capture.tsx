import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { drainQueue, getQueueRevision, listAll, subscribeQueue } from '@/capture/queue';
import { AppText } from '@/components/AppText';
import { useOmnibar } from '@/components/omnibar/OmnibarContext';
import { useTheme } from '@/theme/ThemeProvider';

export default function CaptureScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open } = useOmnibar();
  const revision = useSyncExternalStore(subscribeQueue, getQueueRevision, getQueueRevision);
  const captures = useMemo(() => {
    void revision;
    return listAll(30);
  }, [revision]);

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 8, paddingBottom: t.layout.tabPillHeight + 56 }]}>
        <View style={styles.header}>
          <View>
            <AppText variant="display1">Capture</AppText>
            <AppText variant="caption" tone="muted">Text, link, image, file, or camera. Voice appears only when the node advertises transcription.</AppText>
          </View>
          <Pressable onPress={() => void drainQueue()} accessibilityLabel="Retry queued captures" hitSlop={10}>
            <Ionicons name="refresh" size={20} color={t.c.textMuted} />
          </Pressable>
        </View>

        <Pressable onPress={() => open()} style={[styles.newCapture, { backgroundColor: t.c.primary }]}>
          <Ionicons name="add" size={26} color={t.c.onPrimary} />
          <AppText variant="headline" tone="onPrimary">New capture</AppText>
        </Pressable>

        <View style={styles.queueHeader}>
          <AppText variant="display2">On this phone</AppText>
          <AppText variant="caption" tone="muted">The queue is visible. Network failure never erases a capture.</AppText>
        </View>
        {captures.length ? captures.map((capture) => (
          <Pressable
            key={capture.id}
            onPress={() => capture.state === 'error' || capture.state === 'kept' ? void drainQueue() : undefined}
            style={[styles.row, { backgroundColor: t.c.raised, borderColor: t.c.border }]}
          >
            <Ionicons
              name={capture.state === 'filed' || capture.state === 'answered' ? 'checkmark-circle-outline' : capture.state === 'error' ? 'warning-outline' : 'cloud-upload-outline'}
              size={20}
              color={capture.state === 'error' ? t.c.destructive : capture.state === 'filed' || capture.state === 'answered' ? t.speaker.memory : t.c.primary}
            />
            <View style={styles.rowCopy}>
              <AppText variant="sub" numberOfLines={1}>{capture.title ?? (capture.text || capture.kindHint || 'Capture')}</AppText>
              <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>
                {capture.source} · {capture.state.replaceAll('_', ' ')}
              </AppText>
              {capture.error ? <AppText variant="caption" style={{ color: t.c.destructive }}>{capture.error}</AppText> : null}
            </View>
          </Pressable>
        )) : (
          <View style={[styles.empty, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
            <AppText variant="headline">Nothing queued</AppText>
            <AppText variant="caption" tone="muted">Share into CommonPlace or start a quick note here.</AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  newCapture: { minHeight: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  queueHeader: { gap: 4, marginTop: 4 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowCopy: { flex: 1, gap: 2 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 6 },
});
