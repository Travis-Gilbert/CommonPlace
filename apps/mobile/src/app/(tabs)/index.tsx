/**
 * Mobile Index: the three bands (What landed / What is open / What today holds)
 * as the home tab. One column, virtualized, porcelain. No counts, no badges;
 * the only warm red is the needs-you card and pending approvals. Unsynced
 * captures are never invisible: the On-this-phone group sits on top until the
 * queue drains. Search is a pull-down (header sits above the fold).
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editItem, fetchBriefing, fetchItems, fetchOrganize, searchItems } from '@/api/queries';
import type { ItemGql } from '@/api/types';
import { drainQueue, listPending, subscribeQueue, type CaptureRow } from '@/capture/queue';
import { AppText } from '@/components/AppText';
import { KindRow, type KindRowData } from '@/components/kind/KindRow';
import { useTheme } from '@/theme/ThemeProvider';

type Row =
  | { type: 'pending'; row: CaptureRow }
  | { type: 'needs-you'; item: { id: string; kind: string; title: string; preview: string; label?: string | null } }
  | { type: 'item'; item: ItemGql };

function usePendingCaptures(): CaptureRow[] {
  return useSyncExternalStore(subscribeQueue, listPending, listPending);
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function IndexScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const pending = usePendingCaptures();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ItemGql[] | null>(null);

  const organize = useQuery({ queryKey: ['organize'], queryFn: () => fetchOrganize('day') });
  const briefing = useQuery({ queryKey: ['briefing'], queryFn: fetchBriefing });
  const items = useQuery({ queryKey: ['items'], queryFn: () => fetchItems() });

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const h = setTimeout(() => {
      searchItems(search.trim(), 20)
        .then((hits) => setSearchResults(hits.map((h) => h.item)))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(h);
  }, [search]);

  const sections = useMemo(() => {
    if (searchResults) {
      return [{ title: 'Search', data: searchResults.map((item) => ({ type: 'item', item }) as Row) }];
    }
    const out: { title: string; data: Row[] }[] = [];
    if (pending.length > 0) {
      out.push({ title: 'On this phone', data: pending.map((row) => ({ type: 'pending', row }) as Row) });
    }
    const landed: Row[] = [];
    const filed = organize.data?.organizedToday;
    if (filed?.mostRecent) {
      landed.push({
        type: 'item',
        item: {
          id: filed.mostRecent.item.id,
          kind: filed.mostRecent.item.kind,
          title: filed.mostRecent.item.title,
          bodyText: filed.mostRecent.item.preview,
          residency: 'filed',
          tags: filed.mostRecent.item.tags,
          collections: [],
          createdAtMs: 0,
          updatedAtMs: 0,
          classification: filed.mostRecent.item.classification.targetCollectionLabel,
        } as ItemGql,
      });
    }
    for (const it of briefing.data?.recent ?? []) landed.push({ type: 'item', item: it });
    if (landed.length) out.push({ title: 'What landed', data: landed });

    const open: Row[] = [];
    for (const n of organize.data?.needsYou ?? []) {
      open.push({
        type: 'needs-you',
        item: {
          id: n.id,
          kind: n.kind,
          title: n.title,
          preview: n.preview,
          label: n.classification.targetCollectionLabel,
        },
      });
    }
    for (const it of briefing.data?.openThreads ?? []) open.push({ type: 'item', item: it });
    if (open.length) out.push({ title: 'What is open', data: open });

    const today0 = startOfToday();
    const today1 = today0 + 86_400_000;
    const todays = (items.data ?? []).filter((it) => {
      const due = it.dueAtMs ?? 0;
      const remind = it.remindAtMs ?? 0;
      const isDone = /^(done|closed|complete|completed|cancelled|canceled)$/i.test(it.status ?? '');
      return !isDone && ((due >= today0 && due < today1) || (remind >= today0 && remind < today1));
    });
    if (todays.length) out.push({ title: 'What today holds', data: todays.map((item) => ({ type: 'item', item }) as Row) });
    return out;
  }, [pending, organize.data, briefing.data, items.data, searchResults]);

  const refetchAll = () => {
    void drainQueue();
    void qc.invalidateQueries();
  };

  async function act(item: ItemGql, action: 'done' | 'park') {
    try {
      if (action === 'done') await editItem({ id: item.id, status: 'done' });
      else await editItem({ id: item.id, residency: 'parked' });
    } finally {
      void qc.invalidateQueries();
    }
  }

  const renderActions = (item: ItemGql) => (
    <View style={styles.actions}>
      <Pressable onPress={() => void act(item, 'done')} style={[styles.action, { backgroundColor: t.accents.green }]}>
        <Ionicons name="checkmark" size={20} color="#fff" />
        <AppText variant="micro" style={{ color: '#fff' }}>Done</AppText>
      </Pressable>
      <Pressable onPress={() => void act(item, 'park')} style={[styles.action, { backgroundColor: t.accents.steel }]}>
        <Ionicons name="pause" size={20} color="#fff" />
        <AppText variant="micro" style={{ color: '#fff' }}>Park</AppText>
      </Pressable>
      <Pressable
        onPress={() => router.push({ pathname: '/object/[id]', params: { id: item.id, refile: '1' } })}
        style={[styles.action, { backgroundColor: t.c.primary }]}
      >
        <Ionicons name="folder-open-outline" size={20} color="#fff" />
        <AppText variant="micro" style={{ color: '#fff' }}>Refile</AppText>
      </Pressable>
    </View>
  );

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.type === 'pending') {
      const receipt = row.row.receiptJson ? JSON.parse(row.row.receiptJson) : null;
      const data: KindRowData = {
        id: row.row.id,
        kind: row.row.kindHint ?? (row.row.verb === 'ask' ? 'hunch' : 'note'),
        title: row.row.title ?? row.row.text,
        subtitle: row.row.verb === 'ask' ? 'Ask, waiting to send' : null,
        stateChip:
          row.row.state === 'syncing' ? 'Syncing' : row.row.state === 'error' ? 'Retry' : 'On this phone',
        stateChipTone: 'pending',
      };
      return <KindRow data={data} onPress={() => void drainQueue()} />;
    }
    if (row.type === 'needs-you') {
      // Human-facing: a needs-you card ("Needs your call"), never a category label.
      return (
        <KindRow
          data={{
            id: row.item.id,
            kind: row.item.kind,
            title: row.item.title,
            subtitle: row.item.label ? `Suggested: ${row.item.label}` : row.item.preview,
            stateChip: 'Needs your call',
            stateChipTone: 'needs-you',
          }}
          onPress={() => router.push({ pathname: '/object/[id]', params: { id: row.item.id, refile: '1' } })}
        />
      );
    }
    const item = row.item;
    const isDone = /^(done|closed|complete|completed)$/i.test(item.status ?? '');
    return (
      <ReanimatedSwipeable renderRightActions={() => renderActions(item)} overshootRight={false}>
        <KindRow
          data={{
            id: item.id,
            kind: item.kind,
            title: item.title,
            subtitle: item.classification ?? item.bodyText?.slice(0, 80) ?? null,
            stateChip: item.collections.length ? undefined : null,
            done: isDone,
          }}
          onPress={() => router.push({ pathname: '/object/[id]', params: { id: item.id } })}
        />
      </ReanimatedSwipeable>
    );
  };

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display1">Index</AppText>
        <Pressable
          onPress={() => router.push('/account')}
          accessibilityLabel="Account"
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: pressed ? t.c.muted : t.c.secondary, borderCurve: 'continuous' },
          ]}
        >
          <Ionicons name="person-outline" size={18} color={t.c.textMuted} />
        </Pressable>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(row) => (row.type === 'pending' ? row.row.id : row.item.id)}
        renderItem={renderRow}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchAll} tintColor={t.c.textMuted} />}
        ListHeaderComponent={
          <View style={[styles.search, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
            <Ionicons name="search-outline" size={16} color={t.c.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your commonplace"
              placeholderTextColor={t.c.textFaint}
              style={[styles.searchInput, { color: t.c.text }]}
              maxFontSizeMultiplier={1.4}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <AppText variant="display2">{section.title}</AppText>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="sub" tone="muted">
              {organize.isLoading || briefing.isLoading ? 'Fetching your index...' : 'Nothing yet. Capture something.'}
            </AppText>
          </View>
        }
        contentContainerStyle={{ paddingBottom: t.layout.tabPillHeight + 48 }}
      />
    </GestureHandlerRootView>
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
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  empty: { padding: 48, alignItems: 'center' },
  actions: { flexDirection: 'row' },
  action: { width: 72, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
