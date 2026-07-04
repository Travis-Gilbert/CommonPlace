/**
 * The kind renderers: one row grammar for every object kind, shared by Index
 * and Data so both faces render the same objects the same way (D2 acceptance).
 * No counts, no badges; the only red on porcelain is oxblood on actions.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  note: 'document-text-outline',
  task: 'checkbox-outline',
  epic: 'flag-outline',
  link: 'link-outline',
  file: 'folder-outline',
  image: 'image-outline',
  doc: 'reader-outline',
  audio: 'mic-outline',
  sticky: 'bookmark-outline',
  source: 'library-outline',
};

export type KindRowData = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  /** local-queue state chip: 'On this phone' | 'Syncing' | receipt destination */
  stateChip?: string | null;
  stateChipTone?: 'pending' | 'receipt' | 'needs-you';
  done?: boolean;
};

export function KindRow({
  data,
  onPress,
  onLongPress,
}: {
  data: KindRowData;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const kind = data.kind?.toLowerCase() ?? 'note';
  const icon = KIND_ICON[kind] ?? 'ellipse-outline';
  const kindColor = t.kindColors[kind] ?? t.c.textFaint;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? t.c.muted : t.c.surface,
          borderBottomColor: t.c.border,
          minHeight: t.layout.touchTargetMin + 12,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
        <Ionicons name={icon} size={17} color={kindColor} />
      </View>
      <View style={styles.body}>
        <AppText
          variant="sub"
          numberOfLines={2}
          style={data.done ? { textDecorationLine: 'line-through', color: t.c.textFaint } : undefined}
        >
          {data.title || 'Untitled'}
        </AppText>
        {data.subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {data.subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.right}>
        {data.stateChip ? (
          <View
            style={[
              styles.chip,
              {
                borderCurve: 'continuous',
                backgroundColor:
                  data.stateChipTone === 'needs-you'
                    ? t.c.primaryWash
                    : data.stateChipTone === 'pending'
                      ? t.c.secondary
                      : t.c.muted,
              },
            ]}
          >
            <AppText
              variant="micro"
              style={{ color: data.stateChipTone === 'needs-you' ? t.c.primary : t.c.textMuted }}
            >
              {data.stateChip}
            </AppText>
          </View>
        ) : null}
        {data.meta ? (
          <AppText variant="micro" tone="faint">
            {data.meta}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
