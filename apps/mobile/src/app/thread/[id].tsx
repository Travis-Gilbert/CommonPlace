import { Ionicons } from '@expo/vector-icons';
import {
  AttachmentPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isAbortError, streamHostedChat, type HostedChatContentPart } from '@/api/chat';
import { fetchInstanceCapabilities, readInstanceSettings } from '@/api/instance';
import { searchItems } from '@/api/queries';
import type { ItemGql } from '@/api/types';
import { sceneForInput } from '@/api/scene';
import { appendMessage, createThread, listMessages, resolveMessage } from '@/chat/threads';
import { AppText } from '@/components/AppText';
import { ChatCapabilitySheet } from '@/components/chat/ChatCapabilitySheet';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { PressableSurface } from '@/components/PressableSurface';
import { useTheme } from '@/theme/ThemeProvider';

function messageText(message: ThreadMessage): string {
  return message.content
    .filter((part): part is Extract<(typeof message.content)[number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function initialMessages(threadId: string): ThreadMessageLike[] {
  return listMessages(threadId)
    .filter((message) => !message.pending)
    .map((message) => ({
      id: message.id,
      role: message.role === 'agent' ? 'assistant' : message.role,
      content: message.text,
      createdAt: new Date(message.createdAt),
      status: message.role === 'agent' ? { type: 'complete', reason: 'stop' } : undefined,
      metadata: { custom: { localMessageId: message.id, sceneUrl: message.sceneUrl ?? undefined } },
    }));
}

function UserMessage() {
  const t = useTheme();
  return (
    <MessagePrimitive.Root
      accessibilityLabel="You"
      style={[styles.userMessage, { backgroundColor: t.c.surface }]}
    >
      <MessagePrimitive.Attachments components={{ Attachment: MessageAttachment }} />
      <MessagePrimitive.Content
        renderText={({ part }) => (
          <AppText style={{ color: t.speaker.human, fontFamily: t.speakerFonts.human }}>{part.text}</AppText>
        )}
      />
    </MessagePrimitive.Root>
  );
}

function MessageAttachment() {
  const t = useTheme();
  return (
    <AttachmentPrimitive.Root style={[styles.messageAttachment, { backgroundColor: t.c.secondary }]}>
      <Ionicons name="document-outline" size={15} color={t.speaker.human} />
      <AttachmentPrimitive.Name
        numberOfLines={1}
        style={[t.type.caption, styles.attachmentName, { color: t.speaker.human }]}
      />
    </AttachmentPrimitive.Root>
  );
}

function ComposerAttachment() {
  const t = useTheme();
  return (
    <AttachmentPrimitive.Root style={[styles.composerAttachment, { backgroundColor: t.c.secondary }]}>
      <Ionicons name="document-outline" size={15} color={t.c.textMuted} />
      <AttachmentPrimitive.Name
        numberOfLines={1}
        style={[t.type.caption, styles.attachmentName, { color: t.c.text }]}
      />
      <AttachmentPrimitive.Remove accessibilityLabel="Remove attachment" hitSlop={8}>
        <Ionicons name="close" size={16} color={t.c.textMuted} />
      </AttachmentPrimitive.Remove>
    </AttachmentPrimitive.Root>
  );
}

function AssistantMessage() {
  const t = useTheme();
  const message = useAuiState((state) => state.message);
  const allMessages = useAuiState((state) => state.thread.messages);
  const [sceneLoading, setSceneLoading] = useState(false);
  const text = messageText(message);
  const custom = message.metadata.custom as { localMessageId?: string; sceneUrl?: string };
  const previousQuestion = [...allMessages]
    .slice(0, message.index)
    .reverse()
    .find((candidate) => candidate.role === 'user');

  async function openScene() {
    setSceneLoading(true);
    try {
      if (custom.sceneUrl) {
        router.push({ pathname: '/scene', params: { url: custom.sceneUrl } });
        return;
      }
      const reference = await sceneForInput(previousQuestion ? messageText(previousQuestion) : text.slice(0, 200));
      if (!reference) return;
      if (custom.localMessageId) resolveMessage(custom.localMessageId, text, reference.url);
      router.push({ pathname: '/scene', params: { url: reference.url } });
    } finally {
      setSceneLoading(false);
    }
  }

  if (!text && message.status?.type === 'running') return null;
  return (
    <MessagePrimitive.Root accessibilityLabel="Harness" style={styles.assistantMessage}>
      <MessagePrimitive.Content
        renderText={({ part }) => (
          <AppText style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.agent }}>{part.text}</AppText>
        )}
      />
      {message.status?.type === 'complete' && text ? (
        <Pressable
          onPress={() => void openScene()}
          style={[styles.sceneButton, { borderColor: t.machine.line }]}
          accessibilityLabel="View answer as scene"
        >
          <Ionicons name={sceneLoading ? 'hourglass-outline' : 'planet-outline'} size={14} color={t.speaker.agent} />
          <AppText variant="micro" style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.machine }}>
            {sceneLoading ? 'Composing scene...' : custom.sceneUrl ? 'Open scene' : 'View as scene'}
          </AppText>
        </Pressable>
      ) : null}
    </MessagePrimitive.Root>
  );
}

function MentionTray() {
  const t = useTheme();
  const aui = useAui();
  const text = useAuiState((state) => state.composer.text);
  const [mentions, setMentions] = useState<ItemGql[]>([]);
  const query = text.match(/@([\w-]{2,})$/)?.[1] ?? null;

  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => {
      searchItems(query, 5)
        .then((hits) => setMentions(hits.map((hit) => hit.item)))
        .catch(() => setMentions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!query || mentions.length === 0) return null;
  return (
    <View style={[styles.mentions, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
      {mentions.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => {
            aui.composer().setText(text.replace(/@[\w-]*$/, `@[${item.title}](${item.id}) `));
            setMentions([]);
          }}
          style={styles.mentionRow}
        >
          <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>{item.title}</AppText>
          <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>{item.kind}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function ThreadComposer({
  unavailable,
  attachmentsAvailable,
}: {
  unavailable: boolean;
  attachmentsAvailable: boolean;
}) {
  const t = useTheme();
  const aui = useAui();
  const insets = useSafeAreaInsets();
  const running = useAuiState((state) => state.thread.isRunning);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(48);

  async function addFile() {
    if (!attachmentsAvailable) {
      throw new Error('The hosted ACP route does not advertise attachment support.');
    }
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if ((asset.size ?? 0) > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.');
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const base64 = await new ExpoFile(asset.uri).base64();
    const image = mimeType.startsWith('image/');
    await aui.composer().addAttachment({
      type: image ? 'image' : 'document',
      name: asset.name,
      contentType: mimeType,
      content: image
        ? [{ type: 'image', image: `data:${mimeType};base64,${base64}`, filename: asset.name }]
        : [{ type: 'file', data: base64, mimeType, filename: asset.name }],
    });
  }

  function insertCapabilityPrompt(kind: 'object' | 'plugin' | 'skill' | 'web') {
    const prompts = {
      object: '@',
      plugin: 'Use the plugin ',
      skill: 'Use the skill ',
      web: 'Search the web for ',
    } as const;
    const current = aui.composer().getState().text.trimEnd();
    aui.composer().setText(`${current}${current ? '\n' : ''}${prompts[kind]}`);
    aui.composer().setRunConfig({ custom: { requestedCapability: kind } });
  }

  return (
    <View
      style={[
        styles.composerDock,
        {
          backgroundColor: t.c.bg,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <MentionTray />
      <ComposerPrimitive.Root
        style={[
          styles.composer,
          {
            backgroundColor: t.c.surface,
            borderColor: t.c.border,
            borderCurve: 'continuous',
            boxShadow: t.contactShadow || undefined,
          },
        ]}
      >
        <ComposerPrimitive.Attachments components={{ Attachment: ComposerAttachment }} />
        <View style={[styles.inputClip, { height: inputHeight }]}>
          <ComposerPrimitive.Input
            editable={!unavailable}
            placeholder={unavailable ? 'Connect hosted ACP to chat' : 'Message the harness...'}
            placeholderTextColor={t.c.textFaint}
            multiline
            maxFontSizeMultiplier={1.4}
            onContentSizeChange={(event) => {
              setInputHeight(Math.min(132, Math.max(48, event.nativeEvent.contentSize.height + 14)));
            }}
            style={[styles.input, { color: t.c.text, height: inputHeight }]}
          />
        </View>
        <View style={styles.composerControls}>
          <PressableSurface
            onPress={() => setCapabilitiesOpen(true)}
            accessibilityLabel="Add to this chat"
            style={[styles.composerIcon, { backgroundColor: t.c.secondary }]}
            pressedStyle={{ backgroundColor: t.c.muted }}
          >
            <Ionicons name="add" size={22} color={t.c.text} />
          </PressableSurface>
          <View style={[styles.agentChip, { backgroundColor: t.c.secondary }]}>
            <Ionicons name="sparkles-outline" size={14} color={t.speaker.agent} />
            <AppText variant="caption" numberOfLines={1} style={{ color: t.c.text }}>
              Harness
            </AppText>
            <AppText variant="micro" numberOfLines={1} style={{ color: t.speaker.agent }}>
              Grounded
            </AppText>
          </View>
          <View style={styles.composerSpacer} />
          {running ? <PresenceMark active /> : null}
          {running ? (
            <ComposerPrimitive.Cancel
              accessibilityLabel="Stop"
              style={[styles.send, { backgroundColor: t.c.text }]}
            >
              <Ionicons name="stop" size={15} color={t.c.bg} />
            </ComposerPrimitive.Cancel>
          ) : (
            <ComposerPrimitive.Send
              disabled={unavailable}
              accessibilityLabel="Send"
              style={[styles.send, { backgroundColor: unavailable ? t.c.secondary : t.c.text }]}
            >
              <Ionicons name="arrow-up" size={18} color={unavailable ? t.c.textFaint : t.c.bg} />
            </ComposerPrimitive.Send>
          )}
        </View>
      </ComposerPrimitive.Root>
      <ChatCapabilitySheet
        visible={capabilitiesOpen}
        fileEnabled={attachmentsAvailable}
        onClose={() => setCapabilitiesOpen(false)}
        onAddFile={addFile}
        onInsertPrompt={insertCapabilityPrompt}
      />
    </View>
  );
}

function AssistantThread({
  unavailable,
  attachmentsAvailable,
}: {
  unavailable: boolean;
  attachmentsAvailable: boolean;
}) {
  const t = useTheme();
  return (
    <ThreadPrimitive.Root style={styles.thread}>
      <ThreadPrimitive.Empty>
        <View style={styles.empty}>
          <View style={[styles.emptyMark, { backgroundColor: t.c.secondary }]}>
            <PresenceMark active={false} />
          </View>
          <AppText variant="display2" style={{ textAlign: 'center' }}>What are we working through?</AppText>
          <AppText variant="sub" tone="muted" style={{ textAlign: 'center' }}>
            Ask from live context or mention an object with @.
          </AppText>
        </View>
      </ThreadPrimitive.Empty>
      <ThreadPrimitive.Messages
        components={{ UserMessage, AssistantMessage }}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: t.c.bg }}
      />
      <ThreadComposer unavailable={unavailable} attachmentsAvailable={attachmentsAvailable} />
    </ThreadPrimitive.Root>
  );
}

export default function ThreadScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = id!;
  const [chatAvailable, setChatAvailable] = useState<boolean | null>(null);
  const [chatAttachments, setChatAttachments] = useState(false);
  const seed = useMemo(() => initialMessages(threadId), [threadId]);
  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const latest = [...messages].reverse().find((message) => message.role === 'user');
      const question = latest ? messageText(latest) : '';
      const content: HostedChatContentPart[] = [];
      for (const part of latest?.content ?? []) {
        if (part.type === 'text') content.push({ type: 'text', text: part.text });
        if (part.type === 'file') {
          content.push({ type: 'file', data: part.data, mimeType: part.mimeType, filename: part.filename });
        }
        if (part.type === 'image') content.push({ type: 'image', image: part.image, filename: part.filename });
      }
      if (content.length === 0) content.push({ type: 'text', text: question });
      const attachments = content.filter((part) => part.type !== 'text');
      const attachmentSummary = attachments
        .map((part) => part.filename)
        .filter((filename): filename is string => Boolean(filename))
        .join(', ');
      appendMessage(threadId, 'user', question || attachmentSummary || 'Attachment');
      try {
        if (attachments.length > 0 && !chatAttachments) {
          throw new Error('The hosted ACP route does not accept file or image content parts.');
        }
        let answer = '';
        for await (const snapshot of streamHostedChat(content, abortSignal)) {
          answer = snapshot;
          yield { content: [{ type: 'text', text: answer }] };
        }
        const stored = appendMessage(threadId, 'agent', answer);
        yield {
          content: [{ type: 'text', text: answer }],
          metadata: { custom: { localMessageId: stored.id } },
        };
      } catch (error) {
        if (abortSignal.aborted || isAbortError(error)) throw error;
        const failure = error instanceof Error ? error.message : String(error);
        const text = `Could not reach hosted ACP: ${failure}`;
        const stored = appendMessage(threadId, 'agent', text);
        yield {
          content: [{ type: 'text', text }],
          metadata: { custom: { localMessageId: stored.id, failed: true } },
        };
      }
    },
  }), [chatAttachments, threadId]);
  const runtime = useLocalRuntime(adapter, { initialMessages: seed });

  useEffect(() => {
    readInstanceSettings().then((settings) => setChatAvailable(Boolean(settings.chatUrl?.trim())));
    fetchInstanceCapabilities().then((capabilities) => {
      setChatAttachments(capabilities.chatAttachments);
    });
  }, []);

  function startNewThread() {
    const thread = createThread('New thread');
    router.replace({ pathname: '/thread/[id]', params: { id: thread.id } });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'height' : undefined}
      style={[styles.root, { backgroundColor: t.c.bg }]}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <PressableSurface
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={[styles.headerButton, { backgroundColor: t.c.surface, borderColor: t.c.border }]}
          pressedStyle={{ backgroundColor: t.c.muted }}
        >
          <Ionicons name="chevron-back" size={22} color={t.c.text} />
        </PressableSurface>
        <PressableSurface
          onPress={startNewThread}
          accessibilityLabel="New thread"
          style={[styles.headerButton, { backgroundColor: t.c.surface, borderColor: t.c.border }]}
          pressedStyle={{ backgroundColor: t.c.muted }}
        >
          <Ionicons name="add" size={23} color={t.c.text} />
        </PressableSurface>
      </View>
      <AssistantRuntimeProvider runtime={runtime}>
        <AssistantThread
          unavailable={chatAvailable !== true}
          attachmentsAvailable={chatAttachments}
        />
      </AssistantRuntimeProvider>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  thread: { flex: 1 },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12,
  },
  headerButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  messages: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20, gap: 18, flexGrow: 1 },
  userMessage: {
    maxWidth: '88%', alignSelf: 'flex-end', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 14, borderCurve: 'continuous',
  },
  messageAttachment: {
    maxWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, marginBottom: 8,
  },
  assistantMessage: { maxWidth: '94%', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 8, gap: 10 },
  sceneButton: {
    minHeight: 32, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 9,
  },
  empty: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyMark: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  mentions: { marginHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  mentionRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  composerDock: { paddingHorizontal: 12, paddingTop: 6 },
  composer: {
    minHeight: 112, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
  },
  composerAttachment: {
    maxWidth: '100%', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, marginBottom: 2,
  },
  attachmentName: { flexShrink: 1 },
  input: {
    flexGrow: 0, flexShrink: 0, minHeight: 48, maxHeight: 132,
    paddingHorizontal: 4, paddingVertical: 9, fontSize: 17, lineHeight: 23,
  },
  inputClip: { flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
  composerControls: {
    minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8,
    position: 'relative', zIndex: 2,
  },
  composerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  agentChip: {
    height: 40, maxWidth: 172, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12,
  },
  composerSpacer: { flex: 1 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
