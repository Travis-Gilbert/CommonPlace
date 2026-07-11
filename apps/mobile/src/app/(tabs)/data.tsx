/**
 * Data: one tab, segmented lenses. Objects (Ledger-lite with kind renderers),
 * Files (folder tree, read-first), Timeline (today and scrub), Graph
 * (object-scoped neighborhood scene in a WebView). Every object opens the same
 * drawer (D5).
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchItems } from '@/api/queries';
import { sceneForInput } from '@/api/scene';
import type { ItemGql } from '@/api/types';
import { AppText } from '@/components/AppText';
import { KindRow } from '@/components/kind/KindRow';
import { useTheme } from '@/theme/ThemeProvider';

const LENSES = ['Objects', 'Files', 'Timeline', 'Graph'] as const;
type Lens = (typeof LENSES)[number];

export default function DataScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [lens, setLens] = useState<Lens>('Objects');
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [graphQuery, setGraphQuery] = useState('');
  const [graphBusy, setGraphBusy] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const items = useQuery({ queryKey: ['items'], queryFn: () => fetchItems() });

  const kinds = useMemo(() => {
    const s = new Set((items.data ?? []).map((i) => i.kind.toLowerCase()));
    return [...s].sort();
  }, [items.data]);

  const sections = useMemo(() => {
    const data = items.data ?? [];
    if (lens === 'Objects') {
      const filtered = kindFilter ? data.filter((i) => i.kind.toLowerCase() === kindFilter) : data;
      const sorted = [...filtered].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      return [{ title: '', data: sorted }];
    }
    if (lens === 'Files') {
      const files = data.filter((i) => i.path || /^(file|image|doc|audio)$/i.test(i.kind));
      const byFolder = new Map<string, ItemGql[]>();
      for (const f of files) {
        const folder = f.path?.split('/').slice(0, -1).join('/') || '(no folder)';
        byFolder.set(folder, [...(byFolder.get(folder) ?? []), f]);
      }
      return [...byFolder.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([title, data]) => ({ title, data }));
    }
    if (lens === 'Timeline') {
      const sorted = [...data].sort((a, b) => b.createdAtMs - a.createdAtMs);
      const byDay = new Map<string, ItemGql[]>();
      for (const it of sorted) {
        const day = new Date(it.createdAtMs).toDateString();
        byDay.set(day, [...(byDay.get(day) ?? []), it]);
      }
      return [...byDay.entries()].map(([title, data]) => ({ title, data }));
    }
    return [];
  }, [items.data, lens, kindFilter]);

  async function openGraph() {
    const q = graphQuery.trim();
    if (!q) return;
    setGraphBusy(true);
    setGraphError(null);
    try {
      const ref = await sceneForInput(q);
      if (ref) router.push({ pathname: '/scene', params: { url: ref.url } });
      else setGraphError('No gateway configured. Set the gateway URL under Account > Instance.');
    } catch (e) {
      setGraphError(e instanceof Error ? e.message : String(e));
    } finally {
      setGraphBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display1">Data</AppText>
      </View>
      <View style={[styles.segment, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
        {LENSES.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLens(l)}
            accessibilityRole="tab"
            accessibilityState={{ selected: lens === l }}
            style={[
              styles.segmentItem,
              lens === l && { backgroundColor: t.c.raised, borderCurve: 'continuous', boxShadow: t.contactShadow || undefined },
            ]}
          >
            <AppText variant="caption" style={{ color: lens === l ? t.c.text : t.c.textMuted }}>
              {l}
            </AppText>
          </Pressable>
        ))}
      </View>
      {lens === 'Objects' ? (
        <View style={styles.kindChips}>
          <Pressable
            onPress={() => setKindFilter(null)}
            style={[styles.kindChip, { backgroundColor: kindFilter === null ? t.c.primaryWash : t.c.secondary, borderCurve: 'continuous' }]}
          >
            <AppText variant="micro" style={{ color: kindFilter === null ? t.c.primary : t.c.textMuted }}>
              All
            </AppText>
          </Pressable>
          {kinds.map((k) => (
            <Pressable
              key={k}
              onPress={() => setKindFilter(kindFilter === k ? null : k)}
              style={[styles.kindChip, { backgroundColor: kindFilter === k ? t.c.primaryWash : t.c.secondary, borderCurve: 'continuous' }]}
            >
              <AppText variant="micro" style={{ color: kindFilter === k ? t.c.primary : t.c.textMuted }}>
                {k}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {lens === 'Graph' ? (
        <View style={styles.graphLens}>
          <AppText variant="sub" tone="muted">
            Show the neighborhood of an object or question.
          </AppText>
          <View style={[styles.graphInputRow, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
            <Ionicons name="git-network-outline" size={16} color={t.c.textFaint} />
            <TextInput
              value={graphQuery}
              onChangeText={setGraphQuery}
              placeholder="Object title or question"
              placeholderTextColor={t.c.textFaint}
              style={[styles.graphInput, { color: t.c.text }]}
              onSubmitEditing={() => void openGraph()}
              maxFontSizeMultiplier={1.4}
            />
            <Pressable
              onPress={() => void openGraph()}
              disabled={graphBusy}
              style={({ pressed }) => [
                styles.graphGo,
                { backgroundColor: pressed ? t.c.primaryPressed : t.c.primary, borderCurve: 'continuous', opacity: graphBusy ? 0.6 : 1 },
              ]}
            >
              <Ionicons name={graphBusy ? 'hourglass-outline' : 'arrow-forward'} size={16} color={t.c.onPrimary} />
            </Pressable>
          </View>
          {graphError ? (
            <AppText variant="caption" tone="muted">
              {graphError}
            </AppText>
          ) : null}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <AppText variant="caption" tone="faint">
                  {section.title}
                </AppText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <KindRow
              data={{
                id: item.id,
                kind: item.kind,
                title: item.title,
                subtitle: lens === 'Files' ? (item.path ?? item.mime) : (item.classification ?? null),
                meta: lens === 'Timeline' ? new Date(item.createdAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
              }}
              onPress={() => router.push({ pathname: '/object/[id]', params: { id: item.id } })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppText variant="sub" tone="muted">
                {items.isLoading ? 'Loading objects...' : items.isError ? 'Node unreachable.' : 'Nothing here yet.'}
              </AppText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: t.layout.tabPillHeight + 48 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { paddingHorizontal: 16, paddingBottom: 8 },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 3,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  kindChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 6 },
  kindChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  graphLens: { padding: 16, gap: 12 },
  graphInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 6, height: 44, borderRadius: 12 },
  graphInput: { flex: 1, fontSize: 15 },
  graphGo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 48, alignItems: 'center' },
});
