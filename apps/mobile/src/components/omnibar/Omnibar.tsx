/**
 * The omnibar: ONE bottom sheet for capture AND ask.
 *
 * Default submit verb is Keep: offline-durable, ingest classifies what it
 * becomes, the receipt shows the real kind. Tapping Ask arms the bar
 * (placeholder and accent flip; submit queues the agent). Question-shaped text
 * softly highlights the Ask chip but NEVER auto-routes; the verb stays
 * explicit. That asymmetry is the trust loop: keeping when you meant to ask
 * costs one tap; asking when you meant to keep can lose the note.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioModule,
  RecordingPresets,
  useAudioRecorder,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enqueueCapture, type CaptureSource } from '@/capture/queue';
import { fetchInstanceCapabilities } from '@/api/instance';
import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import { useTheme } from '@/theme/ThemeProvider';

import { useOmnibar } from './OmnibarContext';

const QUESTION_SHAPE = /(^\s*(who|what|when|where|why|how|is|are|do|does|can|could|should|did|will|would)\b)|\?\s*$/i;

type Chip = { id: 'ask' | 'camera' | 'file' | 'voice' | 'web'; icon: keyof typeof Ionicons.glyphMap; label: string };
const CHIPS: Chip[] = [
  { id: 'ask', icon: 'sparkles-outline', label: 'Ask' },
  { id: 'camera', icon: 'camera-outline', label: 'Camera' },
  { id: 'file', icon: 'attach-outline', label: 'File' },
  { id: 'voice', icon: 'mic-outline', label: 'Voice' },
  { id: 'web', icon: 'globe-outline', label: 'Web' },
];

export function Omnibar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, close } = useOmnibar();
  const [text, setText] = useState('');
  const [armed, setArmed] = useState(false); // Ask armed; Keep is the default verb
  const [notify, setNotify] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [attachment, setAttachment] = useState<{ uri: string; mime: string; kind: string } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const questionShaped = QUESTION_SHAPE.test(text);

  useEffect(() => {
    if (!state.visible) return;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const resetTimer = setTimeout(() => {
      const nextText = state.prefill?.text ?? '';
      setText(nextText);
      setArmed(false);
      setNotify(false);
      setConfirm(null);
      setAttachment(
        state.prefill?.attachmentUri
          ? {
              uri: state.prefill.attachmentUri,
              mime: state.prefill.attachmentMime ?? 'application/octet-stream',
              kind: state.prefill.kindHint ?? 'file',
            }
          : null,
      );
      // Paste detection: offer, never auto-insert.
      Clipboard.getStringAsync()
        .then((s) => setClip(s && s.trim().length > 0 && s !== nextText ? s.trim() : null))
        .catch(() => setClip(null));
      if (state.voiceMode) void startRecording();
      else focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    }, 0);
    return () => {
      clearTimeout(resetTimer);
      if (focusTimer) clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.visible]);

  useEffect(() => {
    if (!state.visible) return;
    fetchInstanceCapabilities().then((capabilities) => setVoiceAvailable(capabilities.voiceCapture));
  }, [state.visible]);

  async function startRecording() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }

  async function stopRecording(keep: boolean) {
    await recorder.stop();
    setRecording(false);
    if (keep && recorder.uri) {
      setAttachment({ uri: recorder.uri, mime: 'audio/m4a', kind: 'audio' });
      if (!text) setText('Voice capture');
    }
  }

  function submit() {
    const body = text.trim();
    if (!body && !attachment) return;
    const source: CaptureSource = state.prefill?.source ?? (attachment ? (attachment.kind as CaptureSource) : 'omnibar');
    if (armed) {
      enqueueCapture({ verb: 'ask', text: body, source, notifyOnAnswer: notify });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      close(); // fire-and-forget: the answer lands as an Index row
      return;
    }
    enqueueCapture({
      verb: 'keep',
      text: body || (attachment ? attachment.kind : ''),
      title: state.prefill?.title,
      kindHint: attachment?.kind ?? state.prefill?.kindHint,
      source,
      attachmentUri: attachment?.uri,
      attachmentMime: attachment?.mime,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // queue-write haptic
    setConfirm('Kept on this phone');
    setTimeout(close, 650);
  }

  async function onChip(chip: Chip) {
    switch (chip.id) {
      case 'ask':
        setArmed((a) => !a);
        void Haptics.selectionAsync();
        break;
      case 'camera': {
        const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        const asset = res.assets?.[0];
        if (asset) setAttachment({ uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg', kind: 'image' });
        break;
      }
      case 'file': {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        const asset = res.assets?.[0];
        if (asset) setAttachment({ uri: asset.uri, mime: asset.mimeType ?? 'application/octet-stream', kind: 'file' });
        break;
      }
      case 'voice':
        if (recording) await stopRecording(true);
        else await startRecording();
        break;
      case 'web':
        if (!/^https?:\/\//.test(text)) setText((s) => (s ? s : 'https://'));
        setAttachment(null);
        break;
    }
  }

  if (!state.visible) return null;

  const accent = armed ? t.accents.teal : t.c.primary;
  const accentPressed = armed ? t.accents.tealLight : t.c.primaryPressed;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.avoider}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.c.raised,
              borderColor: t.c.border,
              paddingBottom: Math.max(insets.bottom, 12),
              borderCurve: 'continuous',
              boxShadow: t.contactShadow || undefined,
            },
          ]}
        >
          {confirm ? (
            <View style={styles.confirm}>
              <Ionicons name="checkmark-circle" size={28} color={t.c.primary} />
              <AppText variant="headline">{confirm}</AppText>
            </View>
          ) : (
            <>
              <View style={[styles.grabber, { backgroundColor: t.c.border }]} />
              {clip && !text ? (
                <Pressable
                  onPress={() => {
                    setText(clip);
                    setClip(null);
                  }}
                  style={[styles.pasteChip, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}
                >
                  <Ionicons name="clipboard-outline" size={14} color={t.c.textMuted} />
                  <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                    {'Paste "'}{clip.slice(0, 60)}{clip.length > 60 ? '...' : ''}{'"'}
                  </AppText>
                </Pressable>
              ) : null}
              {attachment ? (
                <View style={[styles.pasteChip, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}>
                  <Ionicons
                    name={attachment.kind === 'image' ? 'image-outline' : attachment.kind === 'audio' ? 'mic-outline' : 'attach-outline'}
                    size={14}
                    color={t.c.textMuted}
                  />
                  <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                    {attachment.uri.split('/').pop()}
                  </AppText>
                  <Pressable onPress={() => setAttachment(null)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={t.c.textMuted} />
                  </Pressable>
                </View>
              ) : null}
              {recording ? (
                <View style={styles.confirm}>
                  <Ionicons name="mic" size={28} color={t.c.primary} />
                  <AppText variant="headline">Recording...</AppText>
                  <Pressable
                    onPress={() => void stopRecording(true)}
                    style={[styles.recordStop, { backgroundColor: t.c.primary, borderCurve: 'continuous' }]}
                  >
                    <AppText variant="sub" tone="onPrimary">
                      Keep it
                    </AppText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    value={text}
                    onChangeText={setText}
                    multiline
                    placeholder={armed ? 'Ask your commonplace...' : 'Keep something...'}
                    placeholderTextColor={t.c.textFaint}
                    style={[styles.input, { color: t.c.text }]}
                    maxFontSizeMultiplier={1.4}
                  />
                  <PressableSurface
                    onPress={submit}
                    accessibilityLabel={armed ? 'Ask' : 'Keep'}
                    style={[styles.submit, { backgroundColor: accent, borderCurve: 'continuous' }]}
                    pressedStyle={{ backgroundColor: accentPressed }}
                  >
                    <Ionicons name={armed ? 'sparkles' : 'arrow-up'} size={20} color={t.c.onPrimary} />
                  </PressableSurface>
                </View>
              )}
              <View style={styles.chipRow}>
                {CHIPS.filter((chip) => chip.id !== 'voice' || voiceAvailable).map((chip) => {
                  const isAsk = chip.id === 'ask';
                  const active = (isAsk && armed) || (chip.id === 'voice' && recording);
                  const softHighlight = isAsk && questionShaped && !armed;
                  return (
                    <PressableSurface
                      key={chip.id}
                      onPress={() => void onChip(chip)}
                      accessibilityLabel={chip.label}
                      style={[
                        styles.chip,
                        {
                          borderCurve: 'continuous',
                          backgroundColor: active ? accent : softHighlight ? t.c.primaryWash : t.c.secondary,
                        },
                      ]}
                      pressedStyle={{ backgroundColor: active ? accent : softHighlight ? t.c.primaryWash : t.c.muted }}
                    >
                      <Ionicons
                        name={chip.icon}
                        size={16}
                        color={active ? t.c.onPrimary : softHighlight ? t.c.primary : t.c.textMuted}
                      />
                      <AppText
                        variant="caption"
                        style={{
                          color: active ? t.c.onPrimary : softHighlight ? t.c.primary : t.c.textMuted,
                        }}
                      >
                        {chip.label}
                      </AppText>
                    </PressableSurface>
                  );
                })}
              </View>
              {armed ? (
                <Pressable onPress={() => setNotify((n) => !n)} style={styles.notifyRow} hitSlop={8}>
                  <Ionicons
                    name={notify ? 'notifications' : 'notifications-off-outline'}
                    size={15}
                    color={notify ? t.c.primary : t.c.textFaint}
                  />
                  <AppText variant="caption" tone={notify ? 'primary' : 'faint'}>
                    {notify ? 'Tell me when the answer lands' : 'Answer lands quietly in Index'}
                  </AppText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,20,19,0.35)',
  },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 2 },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, fontSize: 17, lineHeight: 24, maxHeight: 132, paddingVertical: 8 },
  submit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 999,
  },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  confirm: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  recordStop: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, marginTop: 8 },
});
