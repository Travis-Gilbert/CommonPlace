/**
 * One thread: messages + docked composer with attach, voice, and @-mention of
 * any object. Text fallback always renders first; a scene is an explicit
 * affordance on agent answers (gateway sceneForInput -> WebView sheet), so a
 * slow or failing scene never blocks the answer (D3).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { runTheoremAgent, searchItems } from '@/api/queries';
import { sceneForInput } from '@/api/scene';
import type { ItemGql } from '@/api/types';
import {
  appendMessage,
  listMessages,
  resolveMessage,
  subscribeChat,
  type ChatMessage,
} from '@/chat/threads';
import { AppText } from '@/components/AppText';
import { useOmnibar } from '@/components/omnibar/OmnibarContext';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import { useTheme } from '@/theme/ThemeProvider';

export default function ThreadScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id!;
  const messages = useSyncExternalStore(
    subscribeChat,
    () => listMessages(threadId),
    () => listMessages(threadId),
  );
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<ItemGql[]>([]);
  const [sceneLoading, setSceneLoading] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const { open: openOmnibar } = useOmnibar();

  const mentionQuery = useMemo(() => {
    const m = text.match(/@([\w-]{2,})$/);
    return m ? m[1] : null;
  }, [text]);

  useEffect(() => {
    if (!mentionQuery) {
      setMentions([]);
      return;
    }
    const h = setTimeout(() => {
      searchItems(mentionQuery, 5)
        .then((hits) => setMentions(hits.map((h) => h.item)))
        .catch(() => setMentions([]));
    }, 200);
    return () => clearTimeout(h);
  }, [mentionQuery]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    appendMessage(threadId, 'user', body);
    const pendingMsg = appendMessage(threadId, 'agent', '', { pending: true });
    try {
      const run = await runTheoremAgent(body, 'ask');
      resolveMessage(pendingMsg.id, run.answer || '(empty answer)');
    } catch (e) {
      resolveMessage(pendingMsg.id, `Could not reach the node: ${e instanceof Error ? e.message : e}`);
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }

  async function openScene(msg: ChatMessage) {
    const question = [...messages].reverse().find((m) => m.role === 'user' && m.createdAt < msg.createdAt);
    setSceneLoading(msg.id);
    try {
      if (msg.sceneUrl) {
        router.push({ pathname: '/scene', params: { url: msg.sceneUrl } });
        return;
      }
      const ref = await sceneForInput(question?.text ?? msg.text.slice(0, 200));
      if (ref) {
        resolveMessage(msg.id, msg.text, ref.url);
        router.push({ pathname: '/scene', params: { url: ref.url } });
      }
    } catch {
      // Scene failure leaves the text answer intact (D3 acceptance).
    } finally {
      setSceneLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.c.bg }]}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 6, borderBottomColor: t.c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={t.c.text} />
        </Pressable>
        <AppText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
          Thread
        </AppText>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: m }) => (
          <View
            style={[
              styles.bubble,
              m.role === 'user'
                ? { alignSelf: 'flex-end', backgroundColor: t.c.primary, borderCurve: 'continuous' }
                : { alignSelf: 'flex-start', backgroundColor: t.machine.mid, borderCurve: 'continuous' },
            ]}
          >
            {m.pending ? (
              <WeaveSpinner size={72} color={t.accents.goldLight} />
            ) : (
              <>
                <AppText variant="sub" style={{ color: m.role === 'user' ? t.c.onPrimary : t.machine.text }}>
                  {m.text}
                </AppText>
                {m.role === 'agent' && !m.pending ? (
                  <Pressable
                    onPress={() => void openScene(m)}
                    style={[styles.sceneBtn, { borderColor: t.machine.line, borderCurve: 'continuous' }]}
                  >
                    <Ionicons
                      name={sceneLoading === m.id ? 'hourglass-outline' : 'planet-outline'}
                      size={14}
                      color={t.accents.goldLight}
                    />
                    <AppText variant="micro" style={{ color: t.accents.goldLight }}>
                      {m.sceneUrl ? 'Open scene' : sceneLoading === m.id ? 'Composing scene...' : 'View as scene'}
                    </AppText>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}
      />
      {mentions.length > 0 ? (
        <View style={[styles.mentions, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
          {mentions.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => {
                setText((s) => s.replace(/@[\w-]*$/, `[[${it.title}]] `));
                setMentions([]);
              }}
              style={styles.mentionRow}
            >
              <AppText variant="caption" numberOfLines={1}>
                {it.title}
              </AppText>
              <AppText variant="micro" tone="faint">
                {it.kind}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        style={[
          styles.composer,
          { borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: t.c.surface },
        ]}
      >
        <Pressable
          onPress={() => openOmnibar()}
          accessibilityLabel="Attach via capture"
          hitSlop={8}
          style={styles.composerIcon}
        >
          <Ionicons name="attach" size={22} color={t.c.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => openOmnibar({ voice: true })}
          accessibilityLabel="Voice capture"
          hitSlop={8}
          style={styles.composerIcon}
        >
          <Ionicons name="mic-outline" size={22} color={t.c.textMuted} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Ask, or @ an object"
          placeholderTextColor={t.c.textFaint}
          multiline
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.muted, borderCurve: 'continuous' }]}
          maxFontSizeMultiplier={1.4}
        />
        <Pressable
          onPress={() => void send()}
          accessibilityLabel="Send"
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: pressed ? t.c.primaryPressed : t.c.primary, borderCurve: 'continuous' },
          ]}
        >
          <Ionicons name="arrow-up" size={18} color={t.c.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: '84%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  sceneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mentions: {
    marginHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mentionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerIcon: { paddingBottom: 9 },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
});
