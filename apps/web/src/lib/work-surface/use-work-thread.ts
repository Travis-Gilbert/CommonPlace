'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import {
  useExternalStoreRuntime,
  type ExternalStoreAdapter,
} from '@assistant-ui/react';
import { useLocalYjs } from '@/lib/useLocalYjs';
import { askTheseusAsyncStream } from '@/lib/theseus-api';
import { gqlAsk } from '@/lib/commonplace-graphql';
import { isTauri, roomContext } from '@/lib/desktop';
import type { JsonValue } from '@/lib/block-view/types';
import {
  appendUserMessage,
  appendAssistantPlaceholder,
  applyCancel,
  beginToolCall,
  completeToolCall,
  createStreamHandlers,
  failToolCall,
  nextWorkMessageId,
  toThreadMessageLike,
} from './thread-reducer';
import type { WorkToolCommandName } from './omnibar';
import type { WorkMessage } from './types';

/** Reused from CoordinationView.tsx's own default rather than inventing a new roomId scheme. */
const DEFAULT_ROOM = 'room:ungrouped';

const MESSAGES_KEY = 'messages';

function readMessages(yarray: Y.Array<WorkMessage>): WorkMessage[] {
  return yarray.toArray();
}

function writeMessages(doc: Y.Doc, yarray: Y.Array<WorkMessage>, next: WorkMessage[]): void {
  doc.transact(() => {
    yarray.delete(0, yarray.length);
    yarray.insert(0, next);
  });
}

export interface UseWorkThreadResult {
  runtime: ReturnType<typeof useExternalStoreRuntime>;
  messages: readonly WorkMessage[];
  isAsking: boolean;
  localSynced: boolean;
  /** Sends a message through the same pipeline the assistant-ui runtime uses. Exposed for the omnibar. */
  ask: (query: string) => void;
  /**
   * WS3 one-shot tool dispatch for the omnibar's /recall and /ping commands.
   * Unlike ask(), this never touches the Theseus SSE pipeline: it appends a
   * user message + a single-tool-part assistant message, then resolves that
   * tool part directly against the real backend (gqlAsk / Tauri room_context).
   */
  runTool: (tool: WorkToolCommandName, arg: string) => void;
}

/**
 * WS1 thread runtime.
 *
 * The message log lives in a Yjs Y.Array inside a doc named
 * commonplace-thread:{sessionId}, persisted locally via y-indexeddb
 * (useLocalYjs). A full page reload restores the thread because the
 * Y.Array IS the session log; no separate history API exists or is
 * needed. Chat threads are single-user by spec, so no Hocuspocus
 * network provider is attached here (see plan notes: doc/code/board
 * collab, not chat, needs the network layer).
 *
 * Streaming rides the real askTheseusAsyncStream SSE pipeline; each
 * Theseus pipeline stage becomes a tool-call content part via the pure
 * transitions in thread-reducer.ts.
 */
export function useWorkThread(sessionId: string): UseWorkThreadResult {
  const { doc, synced } = useLocalYjs('commonplace-thread', sessionId);
  const yarray = useMemo(() => doc.getArray<WorkMessage>(MESSAGES_KEY), [doc]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      yarray.observe(onStoreChange);
      return () => yarray.unobserve(onStoreChange);
    },
    [yarray],
  );
  const getSnapshot = useCallback(() => readMessages(yarray), [yarray]);
  const messages = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const askInFlightRef = useRef(false);
  const closeStreamRef = useRef<(() => void) | null>(null);
  const lastUserTextRef = useRef('');
  // Bumped at the top of every ask() call; stream handlers capture the epoch
  // they were created with and bail if it no longer matches, so a stale
  // stream (superseded by a cancel or a newer ask()) can't mutate a message
  // that isn't "theirs" anymore.
  const streamEpochRef = useRef(0);
  // Lets onCancel abort the in-flight fetch/EventSource even if it fires
  // before askTheseusAsyncStream has resolved (i.e. before closeStreamRef
  // is populated).
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  const setMessages = useCallback(
    (updater: (messages: readonly WorkMessage[]) => WorkMessage[]) => {
      writeMessages(doc, yarray, updater(readMessages(yarray)));
    },
    [doc, yarray],
  );

  const ask = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || askInFlightRef.current) return;
      lastUserTextRef.current = trimmed;
      askInFlightRef.current = true;

      const epoch = (streamEpochRef.current += 1);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setMessages((prev) => appendUserMessage(prev, trimmed));
      const assistantId = nextWorkMessageId('assistant');
      currentAssistantIdRef.current = assistantId;
      setMessages((prev) => appendAssistantPlaceholder(prev, assistantId));

      // Guards every mutation this stream's handlers make: if a cancel or a
      // newer ask() has since bumped the epoch, this stream is stale and
      // must not touch the (possibly reassigned) message log.
      const guardedSetMessages = (updater: (messages: readonly WorkMessage[]) => WorkMessage[]) => {
        if (streamEpochRef.current !== epoch) return;
        setMessages(updater);
      };

      const handlers = createStreamHandlers(assistantId, guardedSetMessages, () => {
        if (streamEpochRef.current !== epoch) return;
        askInFlightRef.current = false;
        closeStreamRef.current = null;
        abortControllerRef.current = null;
      });

      void askTheseusAsyncStream(trimmed, { signal: controller.signal }, handlers).then((close) => {
        if (streamEpochRef.current !== epoch) {
          // Superseded while the request was in flight: close immediately
          // instead of handing a stale closer to closeStreamRef.
          close();
          return;
        }
        closeStreamRef.current = close;
      });
    },
    [setMessages],
  );

  // Derived from the persisted log itself (not a separate flag) so it can
  // never drift out of sync with what assistant-ui is actually rendering.
  const isAsking = messages.some((message) => message.role === 'assistant' && message.isStreaming);

  const runTool = useCallback(
    (tool: WorkToolCommandName, arg: string) => {
      if (askInFlightRef.current) return;
      if (tool === 'memory_recall' && !arg.trim()) return; // /recall needs a question

      askInFlightRef.current = true;
      const userText = tool === 'memory_recall' ? `/recall ${arg}` : '/ping';
      setMessages((prev) => appendUserMessage(prev, userText));

      const assistantId = nextWorkMessageId('assistant');
      const toolCallId = `${assistantId}:${tool}`;
      setMessages((prev) => appendAssistantPlaceholder(prev, assistantId));
      setMessages((prev) => beginToolCall(prev, assistantId, toolCallId, tool, { arg }));

      const settle = (result: JsonValue) => {
        setMessages((prev) => completeToolCall(prev, assistantId, toolCallId, result));
        askInFlightRef.current = false;
      };
      const fail = (error: unknown) => {
        setMessages((prev) =>
          failToolCall(prev, assistantId, toolCallId, error instanceof Error ? error.message : String(error)),
        );
        askInFlightRef.current = false;
      };

      if (tool === 'memory_recall') {
        gqlAsk(arg).then((result) => settle(result as unknown as JsonValue), fail);
        return;
      }

      // coordination_ping: honest empty/unavailable state in the browser, no fabricated data.
      if (!isTauri()) {
        fail(new Error('Coordination ping is only available in the CommonPlace desktop app.'));
        return;
      }
      roomContext(DEFAULT_ROOM, arg).then((result) => settle(result as unknown as JsonValue), fail);
    },
    [setMessages],
  );

  const adapter: ExternalStoreAdapter<WorkMessage> = useMemo(
    () => ({
      messages,
      isRunning: isAsking,
      convertMessage: toThreadMessageLike,
      onNew: async (appendMessage) => {
        const textParts = appendMessage.content.filter(
          (part): part is { type: 'text'; text: string } => part.type === 'text',
        );
        ask(textParts.map((part) => part.text).join(' '));
      },
      onCancel: async () => {
        // Bump the epoch first so any in-flight stream handlers become
        // no-ops even if they fire between this line and the abort/close
        // calls below.
        streamEpochRef.current += 1;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        closeStreamRef.current?.();
        closeStreamRef.current = null;
        askInFlightRef.current = false;

        const assistantId = currentAssistantIdRef.current;
        if (assistantId) {
          setMessages((prev) => applyCancel(prev, assistantId));
        }
      },
      onReload: async () => {
        if (lastUserTextRef.current) ask(lastUserTextRef.current);
      },
    }),
    [messages, isAsking, ask],
  );

  const runtime = useExternalStoreRuntime(adapter);

  return { runtime, messages, isAsking, localSynced: synced, ask, runTool };
}
