import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CapabilityCatalog, CapabilityCatalogEntry } from '@/api/instance';
import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import { useTheme } from '@/theme/ThemeProvider';

type CapabilityId = 'file' | 'object' | 'plugin' | 'skill' | 'web';
export type ComposerCapabilityKind = Exclude<CapabilityId, 'file'>;

type Capability = {
  id: CapabilityId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
};

const CAPABILITIES: Capability[] = [
  { id: 'file', icon: 'document-attach-outline', label: 'Add files', detail: 'Attach a document or image to this turn' },
  { id: 'object', icon: 'at-outline', label: 'Mention an object', detail: 'Ground the turn in your commonplace' },
  { id: 'plugin', icon: 'extension-puzzle-outline', label: 'Use a plugin', detail: 'Choose an available plugin' },
  { id: 'skill', icon: 'sparkles-outline', label: 'Use a skill', detail: 'Choose an available skill' },
  { id: 'web', icon: 'globe-outline', label: 'Search the web', detail: 'Request live web research' },
];

type CatalogKind = 'plugin' | 'skill';

type Props = {
  visible: boolean;
  fileEnabled: boolean;
  webEnabled: boolean;
  catalogAvailable: boolean;
  catalog: CapabilityCatalog;
  onClose: () => void;
  onAddFile: () => Promise<void>;
  onSelectCapability: (kind: ComposerCapabilityKind, entry?: CapabilityCatalogEntry) => void;
};

export function ChatCapabilitySheet({
  visible,
  fileEnabled,
  webEnabled,
  catalogAvailable,
  catalog,
  onClose,
  onAddFile,
  onSelectCapability,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogKind, setCatalogKind] = useState<CatalogKind | null>(null);

  function close() {
    setBusy(false);
    setError(null);
    setCatalogKind(null);
    onClose();
  }

  function entriesFor(kind: CatalogKind): CapabilityCatalogEntry[] {
    return kind === 'plugin' ? catalog.plugins : catalog.skills;
  }

  function disabledReason(capability: Capability): string | null {
    if (capability.id === 'file' && !fileEnabled) {
      return 'Unavailable until the hosted ACP route advertises attachment support';
    }
    if (capability.id === 'web' && !webEnabled) {
      return 'Unavailable until this node advertises web search';
    }
    if (capability.id === 'plugin' || capability.id === 'skill') {
      if (!catalogAvailable) return 'Unavailable until this node advertises its capability catalog';
      if (entriesFor(capability.id).length === 0) return `No ${capability.id}s are currently available`;
    }
    return null;
  }

  async function choose(capability: Capability) {
    setError(null);
    if (disabledReason(capability)) return;
    if (capability.id === 'plugin' || capability.id === 'skill') {
      setCatalogKind(capability.id);
      return;
    }
    if (capability.id !== 'file') {
      onSelectCapability(capability.id);
      close();
      return;
    }
    setBusy(true);
    try {
      await onAddFile();
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not attach that file.');
    } finally {
      setBusy(false);
    }
  }

  function chooseCatalogEntry(entry: CapabilityCatalogEntry) {
    onSelectCapability(entry.kind, entry);
    close();
  }

  const entries = catalogKind ? entriesFor(catalogKind) : [];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.frame} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close add menu" style={styles.backdrop} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.c.raised,
              borderColor: t.c.border,
              paddingBottom: Math.max(insets.bottom, 14),
              borderCurve: 'continuous',
              boxShadow: t.contactShadow || undefined,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: t.c.border }]} />
          <View style={styles.heading}>
            {catalogKind ? (
              <PressableSurface
                onPress={() => setCatalogKind(null)}
                accessibilityLabel="Back to capabilities"
                style={[styles.close, { backgroundColor: t.c.secondary }]}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <Ionicons name="chevron-back" size={20} color={t.c.textMuted} />
              </PressableSurface>
            ) : null}
            <View style={{ flex: 1 }}>
              <AppText variant="display2">
                {catalogKind ? `Choose a ${catalogKind}` : 'Add to this chat'}
              </AppText>
              <AppText variant="caption" tone="muted">
                {catalogKind
                  ? 'The exact capability id will be sent with this turn.'
                  : 'Choose context or a capability for the next turn.'}
              </AppText>
            </View>
            <PressableSurface
              onPress={close}
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: t.c.secondary }]}
              pressedStyle={{ backgroundColor: t.c.muted }}
            >
              <Ionicons name="close" size={20} color={t.c.textMuted} />
            </PressableSurface>
          </View>
          {catalogKind ? (
            <ScrollView style={styles.catalog} contentContainerStyle={styles.actions}>
              {entries.map((entry) => (
                <PressableSurface
                  key={`${entry.kind}:${entry.id}`}
                  onPress={() => chooseCatalogEntry(entry)}
                  accessibilityLabel={`Use ${entry.name}`}
                  style={styles.action}
                  pressedStyle={{ backgroundColor: t.c.muted }}
                >
                  <View style={[styles.actionIcon, { backgroundColor: t.c.secondary }]}>
                    <Ionicons
                      name={entry.kind === 'plugin' ? 'extension-puzzle-outline' : 'sparkles-outline'}
                      size={20}
                      color={t.speaker.agent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="sub">{entry.name}</AppText>
                    <AppText variant="caption" tone="muted" numberOfLines={2}>
                      {entry.description || entry.id}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={t.c.textFaint} />
                </PressableSurface>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.actions}>
              {CAPABILITIES.map((capability) => {
                const unavailable = disabledReason(capability);
                return (
                  <PressableSurface
                    key={capability.id}
                    disabled={busy || Boolean(unavailable)}
                    onPress={() => void choose(capability)}
                    accessibilityLabel={unavailable ?? capability.label}
                    style={styles.action}
                    pressedStyle={{ backgroundColor: t.c.muted }}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: t.c.secondary }]}>
                      <Ionicons name={capability.icon} size={20} color={t.speaker.agent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="sub">
                        {capability.id === 'file' && busy ? 'Opening files...' : capability.label}
                      </AppText>
                      <AppText variant="caption" tone="muted">{unavailable ?? capability.detail}</AppText>
                    </View>
                    <Ionicons
                      name={unavailable ? 'lock-closed-outline' : 'chevron-forward'}
                      size={17}
                      color={t.c.textFaint}
                    />
                  </PressableSurface>
                );
              })}
            </View>
          )}
          {error ? <AppText variant="caption" style={{ color: t.c.destructive }}>{error}</AppText> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    maxHeight: '76%', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  catalog: { flexGrow: 0 },
  actions: { gap: 2, paddingBottom: 8 },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 4 },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
