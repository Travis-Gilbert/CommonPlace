'use client';

// SOURCING: jotai (client state) + eventsource-parser (SSE consumption;
// ledger row). The console thread wire: POST to the configured harness chat
// endpoint, consume text/event-stream, reduce into messages. EventSource is
// never used (it cannot POST). With no endpoint configured the thread view
// renders the unavailable state naming the missing capability; nothing here
// fakes activity.

import { atom, getDefaultStore } from 'jotai';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import {
  fetchWorkspaceReadiness,
  type WorkspaceReadiness,
} from '@commonplace/theorem-acp/workspace-state';
import { createAtomStoreFacade } from './store-facade';

export interface ThreadTextPart {
  readonly type: 'text';
  text: string;
}

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: ThreadTextPart[];
  degradation?: ThreadDegradation;
}

export interface ThreadDegradation {
  degraded: true;
  missingIndexes: string[];
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
  /** The ref's canonical `theorem://` address (DESIGN-THEOREM-URI section 3).
   *  When present it is what travels with the message, so a staged mention
   *  names its object the same way a copied address does. */
  readonly address?: string;
}

/** The actual destination of the next turn. These values map directly to the
 * hosted chat request, unlike the former presentational Agent/Plan/Model
 * labels. */
export type ComposerMode = 'theorem' | 'web';

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

export function askDegradation(readiness: WorkspaceReadiness): ThreadDegradation | undefined {
  const missing = readiness.capabilities
    .filter((capability) => capability.capability === 'ask')
    .flatMap((capability) => capability.missing);
  return missing.length ? { degraded: true, missingIndexes: [...new Set(missing)] } : undefined;
}

export const threadMessagesAtom = atom<ThreadMessage[]>([]);
export const threadIsRunningAtom = atom(false);
export const threadErrorAtom = atom<string | null>(null);
export const threadAbortAtom = atom<AbortController | null>(null);
export const threadEndpointAtom = atom<string | null>(chatEndpoint());
export const threadModeAtom = atom<ComposerMode>('theorem');
export const threadPlanAtom = atom<AgentPlanStep[]>([]);
export const threadStagedAtom = atom<StagedThreadRef[]>([]);

const threadSliceAtoms = {
  messages: threadMessagesAtom,
  isRunning: threadIsRunningAtom,
  error: threadErrorAtom,
  abort: threadAbortAtom,
  endpoint: threadEndpointAtom,
  mode: threadModeAtom,
  plan: threadPlanAtom,
  staged: threadStagedAtom,
};

const threadStore = getDefaultStore();

type ThreadActions = Pick<ThreadState, 'stage' | 'unstage' | 'setMode' | 'send' | 'cancel'>;

const threadActions: ThreadActions = {
  stage(refs) {
    threadStore.set(threadStagedAtom, (staged) => {
      const seen = new Set(staged.map((ref) => ref.id));
      return [...staged, ...refs.filter((ref) => !seen.has(ref.id))];
    });
  },

  unstage(id) {
    threadStore.set(threadStagedAtom, (staged) => staged.filter((ref) => ref.id !== id));
  },

  setMode(mode) {
    threadStore.set(threadModeAtom, mode);
  },

  async send(rawText) {
    const endpoint = threadStore.get(threadEndpointAtom);
    if (!endpoint || threadStore.get(threadIsRunningAtom)) return;
    const staged = threadStore.get(threadStagedAtom);
    const refLine = staged
      .map((ref) => {
        const target = ref.address ?? ref.objectId;
        return target ? `@[${ref.label}](${target})` : ref.label;
      })
      .join(' ');
    const text = refLine ? `${rawText}\n${refLine}` : rawText;
    if (staged.length > 0) threadStore.set(threadStagedAtom, []);
    const userMessage: ThreadMessage = { id: nextId(), role: 'user', parts: [{ type: 'text', text }] };
    const assistantMessage: ThreadMessage = { id: nextId(), role: 'assistant', parts: [{ type: 'text', text: '' }] };
    const abort = new AbortController();
    threadStore.set(threadMessagesAtom, (messages) => [...messages, userMessage, assistantMessage]);
    threadStore.set(threadIsRunningAtom, true);
    threadStore.set(threadErrorAtom, null);
    threadStore.set(threadAbortAtom, abort);
    threadStore.set(threadPlanAtom, []);

    void fetchWorkspaceReadiness()
      .then((readiness) => {
        const degradation = askDegradation(readiness);
        if (!degradation) return;
        threadStore.set(threadMessagesAtom, (messages) =>
          messages.map((message) =>
            message.id === assistantMessage.id ? { ...message, degradation } : message),
        );
      })
      .catch(() => {
        // The answer transport remains usable, but no readiness claim is made.
      });

    let pending = '';
    let flushScheduled = false;
    const flush = () => {
      flushScheduled = false;
      if (!pending) return;
      const chunk = pending;
      pending = '';
      threadStore.set(threadMessagesAtom, (messages) =>
        messages.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, parts: [{ type: 'text', text: message.parts[0].text + chunk }] }
            : message,
        ),
      );
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: [{ type: 'text', text }],
          ...(threadStore.get(threadModeAtom) === 'web' ? { capability: { kind: 'web' } } : {}),
        }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`chat endpoint failed: ${response.status}`);
      const parser = createParser({
        onEvent(event: EventSourceMessage) {
          const name = event.event ?? 'message';
          if (name === 'error') {
            threadStore.set(threadErrorAtom, textOf(event.data) || 'stream error');
            return;
          }
          if (name.includes('plan') || name.includes('tool')) {
            const plan = planOf(event.data);
            if (plan) threadStore.set(threadPlanAtom, plan);
            return;
          }
          if (name.includes('delta') || name === 'message' || name === 'text') {
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
      }
      flush();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        threadStore.set(
          threadErrorAtom,
          error instanceof Error ? error.message : 'stream failed',
        );
      }
    } finally {
      flush();
      threadStore.set(threadIsRunningAtom, false);
      threadStore.set(threadAbortAtom, null);
    }
  },

  cancel() {
    threadStore.get(threadAbortAtom)?.abort();
    threadStore.set(threadIsRunningAtom, false);
    threadStore.set(threadAbortAtom, null);
  },
};

const { useStore: useThreadStore } = createAtomStoreFacade<ThreadState>(
  threadSliceAtoms,
  threadActions,
);

export { useThreadStore };
