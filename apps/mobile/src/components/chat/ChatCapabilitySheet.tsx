import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import { useTheme } from '@/theme/ThemeProvider';

type CapabilityId = 'file' | 'object' | 'plugin' | 'skill' | 'web';

type Capability = {
  id: CapabilityId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
};

const CAPABILITIES: Capability[] = [
  { id: 'file', icon: 'document-attach-outline', label: 'Add files', detail: 'Attach a document or image to this turn' },
  { id: 'object', icon: 'at-outline', label: 'Mention an object', detail: 'Ground the turn in your commonplace' },
  { id: 'plugin', icon: 'extension-puzzle-outline', label: 'Use a plugin', detail: 'Name the plugin in the composer' },
  { id: 'skill', icon: 'sparkles-outline', label: 'Use a skill', detail: 'Name the skill in the composer' },
  { id: 'web', icon: 'globe-outline', label: 'Search the web', detail: 'Start a web-research request' },
];

type Props = {
  visible: boolean;
  fileEnabled: boolean;
  onClose: () => void;
  onAddFile: () => Promise<void>;
  onInsertPrompt: (kind: Exclude<CapabilityId, 'file'>) => void;
};

export function ChatCapabilitySheet({ visible, fileEnabled, onClose, onAddFile, onInsertPrompt }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(capability: Capability) {
    setError(null);
    if (capability.id !== 'file') {
      onInsertPrompt(capability.id);
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onAddFile();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not attach that file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.frame} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Close add menu" style={styles.backdrop} onPress={onClose} />
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
            <View style={{ flex: 1 }}>
              <AppText variant="display2">Add to this chat</AppText>
              <AppText variant="caption" tone="muted">Choose context or a capability for the next turn.</AppText>
            </View>
            <PressableSurface
              onPress={onClose}
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: t.c.secondary }]}
              pressedStyle={{ backgroundColor: t.c.muted }}
            >
              <Ionicons name="close" size={20} color={t.c.textMuted} />
            </PressableSurface>
          </View>
          <View style={styles.actions}>
            {CAPABILITIES.map((capability) => (
              <PressableSurface
                key={capability.id}
                disabled={busy || (capability.id === 'file' && !fileEnabled)}
                onPress={() => void choose(capability)}
                accessibilityLabel={capability.id === 'file' && !fileEnabled
                  ? 'Add files unavailable for this chat endpoint'
                  : capability.label}
                style={styles.action}
                pressedStyle={{ backgroundColor: t.c.muted }}
              >
                <View style={[styles.actionIcon, { backgroundColor: t.c.secondary }]}>
                  <Ionicons name={capability.icon} size={20} color={t.speaker.agent} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="sub">{capability.id === 'file' && busy ? 'Opening files...' : capability.label}</AppText>
                  <AppText variant="caption" tone="muted">
                    {capability.id === 'file' && !fileEnabled
                      ? 'Unavailable until the hosted ACP route advertises attachment support'
                      : capability.detail}
                  </AppText>
                </View>
                <Ionicons
                  name={capability.id === 'file' && !fileEnabled ? 'lock-closed-outline' : 'chevron-forward'}
                  size={17}
                  color={t.c.textFaint}
                />
              </PressableSurface>
            ))}
          </View>
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
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16, paddingTop: 10,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 2, marginBottom: 8 },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 4 },
  actionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
