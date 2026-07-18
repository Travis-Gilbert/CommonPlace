/**
 * The object drawer, same anatomy as desktop: provenance, destination token,
 * receipts, object-scoped composer (D5). Every element of a filed receipt is
 * tappable to correct; Refile writes the corrective signal by re-homing the
 * object (D1).
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addToCollection, editItem, fetchCollections, fetchItem, putNote } from '@/api/queries';
import { sceneForInput } from '@/api/scene';
import { objectTheoremUri } from '@/addressing/theoremUri';
import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import { scheduleReminder } from '@/notifications';
import { useTheme } from '@/theme/ThemeProvider';

function fmt(ms?: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ObjectDrawer() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id, refile } = useLocalSearchParams<{ id: string; refile?: string }>();
  const itemId = id!;
  const [showRefile, setShowRefile] = useState(refile === '1');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  const item = useQuery({ queryKey: ['item', itemId], queryFn: () => fetchItem(itemId) });
  const collections = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const invalidate = () => void qc.invalidateQueries();

  // Apply a status change and reconcile; surface a reason if the sync fails
  // instead of dropping the rejection silently (D3.2).
  const applyStatus = (patch: Parameters<typeof editItem>[0], verb: string) =>
    void editItem(patch)
      .then(invalidate)
      .catch(() => Alert.alert('Could not save', `That ${verb} did not go through. Nothing was changed.`));

  async function refileTo(collectionId: string) {
    await addToCollection(itemId, collectionId);
    setShowRefile(false);
    invalidate();
  }

  async function remindAt(ms: number) {
    const updated = await editItem({ id: itemId, remindAtMs: ms }).catch(() => null);
    // Local schedule regardless: the phone owns firing even if the node is old.
    await scheduleReminder({ itemId, title: item.data?.title ?? 'Reminder', remindAtMs: ms });
    if (updated) invalidate();
  }

  async function saveNote() {
    const body = note.trim();
    if (!body) return;
    await putNote(`Re: ${item.data?.title ?? itemId}`, body, [`re:${itemId}`]);
    setNote('');
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }

  async function neighborhood() {
    try {
      const ref = await sceneForInput(item.data?.title ?? itemId);
      if (ref) router.push({ pathname: '/scene', params: { url: ref.url } });
    } catch {
      // graph lens is optional; the drawer stays useful without a gateway
    }
  }

  async function shareObject() {
    if (!item.data) return;
    const url = await objectTheoremUri({ id: item.data.id, kind: item.data.kind });
    await Share.share({ message: `${item.data.title}\n${url}`, url });
  }

  const it = item.data;
  const tonight = () => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  };
  const tomorrow9 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.raised }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={24} color={t.c.text} />
        </Pressable>
        <View style={styles.topbarActions}>
          <Pressable onPress={() => void shareObject()} hitSlop={12} accessibilityLabel="Share theorem address">
            <Ionicons name="share-outline" size={20} color={t.c.textMuted} />
          </Pressable>
          <Pressable onPress={() => void neighborhood()} hitSlop={12} accessibilityLabel="Neighborhood scene">
            <Ionicons name="git-network-outline" size={20} color={t.c.textMuted} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!it ? (
          <AppText variant="sub" tone="muted">
            {item.isLoading ? 'Loading...' : 'Object not found on this node.'}
          </AppText>
        ) : (
          <>
            <AppText variant="display2">{it.title}</AppText>

            {/* Provenance */}
            <View style={styles.metaRow}>
              <AppText variant="micro" tone="faint">
                {it.kind}
              </AppText>
              {it.source ? (
                <AppText variant="micro" tone="faint">
                  from {it.source}
                </AppText>
              ) : null}
              <AppText variant="micro" tone="faint">
                kept {fmt(it.createdAtMs)}
              </AppText>
            </View>

            {/* Destination token + receipt: each element tappable to correct */}
            <View style={styles.chipsRow}>
              {it.collections.length === 0 ? (
                <Pressable
                  onPress={() => setShowRefile((s) => !s)}
                  style={[styles.chip, { backgroundColor: t.c.primaryWash, borderCurve: 'continuous' }]}
                >
                  <AppText variant="caption" tone="primary">
                    {it.residency === 'inbox' ? 'Inbox: file it' : it.residency}
                  </AppText>
                </Pressable>
              ) : (
                it.collections.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setShowRefile((s) => !s)}
                    style={[styles.chip, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
                  >
                    <Ionicons name="folder-outline" size={12} color={t.c.textMuted} />
                    <AppText variant="caption" tone="muted">
                      {collections.data?.find((col) => col.id === c)?.name ?? c}
                    </AppText>
                  </Pressable>
                ))
              )}
              {it.tags.map((tag) => (
                <View key={tag} style={[styles.chip, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
                  <AppText variant="caption" tone="faint">
                    #{tag}
                  </AppText>
                </View>
              ))}
              {it.remindAtMs ? (
                <View style={[styles.chip, { backgroundColor: t.c.primaryWash, borderCurve: 'continuous' }]}>
                  <Ionicons name="alarm-outline" size={12} color={t.c.primary} />
                  <AppText variant="caption" tone="primary">
                    Reminder {fmt(it.remindAtMs)}
                  </AppText>
                </View>
              ) : null}
            </View>

            {showRefile ? (
              <View style={[styles.refile, { backgroundColor: t.c.surface, borderColor: t.c.border, borderCurve: 'continuous' }]}>
                <AppText variant="caption" tone="muted">
                  Refile to
                </AppText>
                {(collections.data ?? []).map((col) => (
                  <Pressable key={col.id} onPress={() => void refileTo(col.id)} style={styles.refileRow}>
                    <Ionicons name="folder-outline" size={16} color={t.c.textMuted} />
                    <AppText variant="sub">{col.name}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {it.bodyText ? (
              <AppText variant="body" style={{ marginTop: 8 }}>
                {it.bodyText}
              </AppText>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <PressableSurface
                onPress={() => applyStatus({ id: itemId, status: 'done' }, 'done')}
                style={[styles.actionBtn, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <Ionicons name="checkmark" size={16} color={t.c.text} />
                <AppText variant="caption">Done</AppText>
              </PressableSurface>
              <PressableSurface
                onPress={() => applyStatus({ id: itemId, residency: 'parked' }, 'park')}
                style={[styles.actionBtn, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <Ionicons name="pause" size={16} color={t.c.text} />
                <AppText variant="caption">Park</AppText>
              </PressableSurface>
              <PressableSurface
                onPress={() => void remindAt(tonight())}
                style={[styles.actionBtn, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <Ionicons name="alarm-outline" size={16} color={t.c.text} />
                <AppText variant="caption">Tonight</AppText>
              </PressableSurface>
              <PressableSurface
                onPress={() => void remindAt(tomorrow9())}
                style={[styles.actionBtn, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <Ionicons name="alarm-outline" size={16} color={t.c.text} />
                <AppText variant="caption">Tomorrow 9</AppText>
              </PressableSurface>
            </View>

            {/* Object-scoped composer */}
            <View style={[styles.composer, { backgroundColor: t.c.surface, borderColor: t.c.border, borderCurve: 'continuous' }]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note on this object"
                placeholderTextColor={t.c.textFaint}
                multiline
                style={[styles.composerInput, { color: t.c.text }]}
                maxFontSizeMultiplier={1.4}
              />
              <PressableSurface
                onPress={() => void saveNote()}
                accessibilityLabel="Save note"
                style={[styles.composerSend, { backgroundColor: t.c.primary, borderCurve: 'continuous' }]}
                pressedStyle={{ backgroundColor: t.c.primaryPressed }}
              >
                <Ionicons name={noteSaved ? 'checkmark' : 'arrow-up'} size={16} color={t.c.onPrimary} />
              </PressableSurface>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  refile: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4 },
  refileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 999 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10, marginTop: 8 },
  composerInput: { flex: 1, fontSize: 15, lineHeight: 20, maxHeight: 90 },
  composerSend: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
