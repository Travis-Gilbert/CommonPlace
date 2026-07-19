'use client';

// SOURCING: zustand (client state) + eventsource-parser (SSE consumption;
// ledger row). The console thread wire: POST to the configured harness chat
// endpoint, consume text/event-stream, reduce into messages. EventSource is
// never used (it cannot POST). With no endpoint configured the thread view
// renders the unavailable state naming the missing capability; nothing here
// fakes activity.

import { create } from 'zustand';
import { createParser, type EventSourceMessage } from 'eventsource-parser';

export interface ThreadTextPart {
  readonly type: 'text';
  text: string;
}

export interface ThreadAcknowledgementPart {
  readonly type: 'data';
  readonly name: 'theorem-acknowledgement';
  readonly data: { readonly text: string };
}

export interface ThreadActivityPart {
  readonly type: 'data';
  readonly name: 'theorem-activity';
  readonly data: { readonly status: 'running' };
}

export type ThreadMessagePart =
  | ThreadTextPart
  | ThreadAcknowledgementPart
  | ThreadActivityPart;

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: ThreadMessagePart[];
}

export interface AgentPlanStep {
  readonly id: string;
  readonly label: string;
  readonly tool?: string;
  readonly status: 'pending' | 'running' | 'complete' | 'refused';
}

/** An object reference staged into the thread by the action sheet's With-me
 *  path (HANDOFF-CARDS-ACTIONS-MENTIONS K4): visible above the composer,
 *  travels with the next message, removable until sent. */
export interface StagedThreadRef {
  readonly id: string;
  readonly label: string;
  readonly objectId?: string;
}

/** The actual destination of the next turn. These values map directly to the
 * hosted chat request, unlike the former presentational Agent/Plan/Model
 * labels. */
export type ComposerMode = 'auto' | 'theorem' | 'web';

export interface ThreadState {
  messages: ThreadMessage[];
  isRunning: boolean;
  error: string | null;
  abort: AbortController | null;
  endpoint: string | null;
  mode: ComposerMode;
  plan: AgentPlanStep[];
  staged: StagedThreadRef[];
  stage(refs: readonly StagedThreadRef[]): void;
  unstage(id: string): void;
  setMode(mode: ComposerMode): void;
  send(text: string): Promise<void>;
  cancel(): void;
}

export function chatEndpoint(): string | null {
  const configured = process.env.NEXT_PUBLIC_CONSOLE_CHAT_URL;
  return configured && configured.length > 0 ? configured : null;
}

let SEQ = 0;
const nextId = () => `msg-${++SEQ}`;

function textOf(data: string): string {
  try {
    const parsed = JSON.parse(data) as { text?: string; delta?: string; content?: string; error?: string };
    // Error payloads carry the real backend message; collapsing them to a
    // generic label buries every failure (the documented SSE error-event
    // trap from the web console wire).
    return parsed.text ?? parsed.delta ?? parsed.content ?? parsed.error ?? '';
  } catch {
    return data;
  }
}

function planOf(data: string): AgentPlanStep[] | null {
  try {
    const parsed = JSON.parse(data) as {
      plan?: { steps?: unknown[] };
      steps?: unknown[];
      id?: string;
      label?: string;
      title?: string;
      tool?: string;
      status?: string;
    };
    const source = parsed.plan?.steps ?? parsed.steps;
    if (Array.isArray(source)) {
      return source.map((value, index) => {
        const step = value as { id?: string; label?: string; title?: string; tool?: string; status?: string };
        const status = step.status === 'running' || step.status === 'complete' || step.status === 'refused'
          ? step.status
          : 'pending';
        return {
          id: step.id ?? `plan-${index}`,
          label: step.label ?? step.title ?? `Step ${index + 1}`,
          tool: step.tool,
          status,
        };
      });
    }
    if (parsed.label || parsed.title || parsed.tool) {
      const status = parsed.status === 'running' || parsed.status === 'complete' || parsed.status === 'refused'
        ? parsed.status
        : 'pending';
      return [{
        id: parsed.id ?? `plan-${Date.now()}`,
        label: parsed.label ?? parsed.title ?? parsed.tool ?? 'Agent step',
        tool: parsed.tool,
        status,
      }];
    }
    return null;
  } catch {
    return null;
  }
}

function acknowledgementOf(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { acknowledgement?: unknown };
    return typeof parsed.acknowledgement === 'string' && parsed.acknowledgement.trim()
      ? parsed.acknowledgement.trim()
      : null;
  } catch {
    return null;
  }
}

function activityOf(data: string): 'running' | null {
  try {
    const parsed = JSON.parse(data) as { status?: unknown };
    return parsed.status === 'running' ? 'running' : null;
  } catch {
    return null;
  }
}

function orderedAssistantParts(
  parts: readonly ThreadMessagePart[],
  change: {
    readonly acknowledgement?: string | null;
    readonly activity?: 'running' | null;
    readonly appendText?: string;
  },
): ThreadMessagePart[] {
  const existingAcknowledgement = parts.find(
    (part): part is ThreadAcknowledgementPart =>
      part.type === 'data' && part.name === 'theorem-acknowledgement',
  );
  const existingActivity = parts.find(
    (part): part is ThreadActivityPart =>
      part.type === 'data' && part.name === 'theorem-activity',
  );
  const existingText = parts.find((part): part is ThreadTextPart => part.type === 'text');
  const acknowledgement = change.acknowledgement === undefined
    ? existingAcknowledgement
    : change.acknowledgement
      ? {
          type: 'data' as const,
          name: 'theorem-acknowledgement' as const,
          data: { text: change.acknowledgement },
        }
      : undefined;
  const activity = change.activity === undefined
    ? existingActivity
    : change.activity === 'running'
      ? {
          type: 'data' as const,
          name: 'theorem-activity' as const,
          data: { status: 'running' as const },
        }
      : undefined;
  const text = `${existingText?.text ?? ''}${change.appendText ?? ''}`;
  return [
    ...(acknowledgement ? [acknowledgement] : []),
    ...(activity ? [activity] : []),
    ...(text ? [{ type: 'text' as const, text }] : []),
  ];
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  messages: [],
  isRunning: false,
  error: null,
  abort: null,
  endpoint: chatEndpoint(),
  mode: 'auto',
  plan: [],
  staged: [],

  stage(refs) {
    set((state) => {
      const seen = new Set(state.staged.map((ref) => ref.id));
      return { staged: [...state.staged, ...refs.filter((ref) => !seen.has(ref.id))] };
    });
  },

  unstage(id) {
    set((state) => ({ staged: state.staged.filter((ref) => ref.id !== id) }));
  },

  setMode(mode) {
    set({ mode });
  },

  async send(rawText: string) {
    const endpoint = get().endpoint;
    if (!endpoint || get().isRunning) return;
    // Staged references travel with the message and clear once sent; they
    // were visible chips the whole time (no invisible context lane).
    const staged = get().staged;
    const refLine = staged
      .map((ref) => (ref.objectId ? `@[${ref.label}](${ref.objectId})` : ref.label))
      .join(' ');
    const text = refLine ? `${rawText}\n${refLine}` : rawText;
    if (staged.length > 0) set({ staged: [] });
    const userMessage: ThreadMessage = { id: nextId(), role: 'user', parts: [{ type: 'text', text }] };
    const assistantMessage: ThreadMessage = { id: nextId(), role: 'assistant', parts: [] };
    const abort = new AbortController();
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isRunning: true,
      error: null,
      abort,
      plan: [],
    }));

    // Text deltas buffer in a local accumulator and flush once per animation
    // frame so re-render cost stays flat during fast streams (the streaming
    // container never participates in layout animation).
    let pending = '';
    let flushScheduled = false;
    const flush = () => {
      flushScheduled = false;
      if (!pending) return;
      const chunk = pending;
      pending = '';
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === assistantMessage.id
            ? {
                ...message,
                parts: orderedAssistantParts(message.parts, { appendText: chunk }),
              }
            : message,
        ),
      }));
    };
    const enqueue = (chunk: string) => {
      pending += chunk;
      if (!flushScheduled) {
        flushScheduled = true;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
        else flush();
      }
    };

    try {
      const mode = get().mode;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: [{ type: 'text', text }],
          ...(mode === 'web'
            ? { capability: { kind: 'web' } }
            : mode === 'theorem'
              ? { capability: { kind: 'theorem' } }
              : {}),
        }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`chat endpoint failed: ${response.status}`);
      let terminal = false;
      const parser = createParser({
        onEvent(event: EventSourceMessage) {
          const name = event.event ?? 'message';
          if (name === 'error') {
            terminal = true;
            set((state) => ({
              error: textOf(event.data) || 'stream error',
              messages: state.messages.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, parts: orderedAssistantParts(message.parts, { activity: null }) }
                  : message,
              ),
            }));
            return;
          }
          if (name === 'turn_prelude') {
            if (terminal) return;
            const acknowledgement = acknowledgementOf(event.data);
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === assistantMessage.id
                  ? {
                      ...message,
                      parts: orderedAssistantParts(message.parts, { acknowledgement }),
                    }
                  : message,
              ),
            }));
            return;
          }
          if (name === 'activity') {
            if (terminal) return;
            const activity = activityOf(event.data);
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, parts: orderedAssistantParts(message.parts, { activity }) }
                  : message,
              ),
            }));
            return;
          }
          if (name === 'done') {
            terminal = true;
            set((state) => ({
              messages: state.messages.map((message) =>
                message.id === assistantMessage.id
                  ? { ...message, parts: orderedAssistantParts(message.parts, { activity: null }) }
                  : message,
              ),
            }));
            return;
          }
          if (name.includes('plan') || name.includes('tool')) {
            if (terminal) return;
            const plan = planOf(event.data);
            if (plan) set({ plan });
            return;
          }
          if (name.includes('delta') || name === 'message' || name === 'text') {
            if (terminal) return;
            enqueue(textOf(event.data));
          }
        },
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
        if (terminal) {
          await reader.cancel();
          break;
        }
      }
      flush();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        set({ error: error instanceof Error ? error.message : 'stream failed' });
      }
    } finally {
      flush();
      set((state) => ({
        isRunning: false,
        abort: null,
        messages: state.messages.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, parts: orderedAssistantParts(message.parts, { activity: null }) }
            : message,
        ),
      }));
    }
  },

  cancel() {
    get().abort?.abort();
    set({ isRunning: false, abort: null });
  },
}));
