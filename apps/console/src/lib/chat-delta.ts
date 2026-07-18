// SOURCING: @commonplace/theorem-acp (state types). The snapshot-to-delta
// adaptation for the console chat wire (R2.2): the bridge emits cumulative
// TheoremAgentState snapshots; the console thread consumes incremental
// {delta} SSE frames. This module is the seam the contract test exercises.

import { BridgeCommandError } from '@commonplace/theorem-acp/bridge';
import type { TheoremAgentState } from '@commonplace/theorem-acp/state';

export interface ConsoleChatBody {
  readonly content: readonly { readonly type: 'text'; readonly text: string }[];
}

export function readText(body: unknown): string {
  if (!body || typeof body !== 'object' || !Array.isArray((body as ConsoleChatBody).content)) {
    throw new BridgeCommandError('Expected { content: [{ type: "text", text }] }.', 400);
  }
  const text = (body as ConsoleChatBody).content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join('\n');
  if (!text) throw new BridgeCommandError('Expected non-empty text content.', 400);
  return text;
}

/** Flatten the bridge's cumulative state snapshots into delta frames: the
 *  console thread accumulates {delta} payloads per animation frame. Refused
 *  and failed turns surface as named error events; the stream closes when
 *  the turn leaves the running state (or permission is pending). */
export function deltaStream(
  subscribe: (listener: (state: TheoremAgentState) => void) => () => void,
  initial: TheoremAgentState,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = () => {};
      let sent = '';
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        signal.removeEventListener('abort', close);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };
      const complete = () => {
        if (closed) return;
        controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        close();
      };
      const write = (state: TheoremAgentState) => {
        if (closed) return;
        const assistant = [...state.messages].reverse().find((message) => message.role === 'assistant');
        const text = assistant?.text ?? '';
        if (text.startsWith(sent) && text.length > sent.length) {
          const delta = text.slice(sent.length);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          sent = text;
        } else if (!text.startsWith(sent) && text.length > 0) {
          // A new turn replaced the transcript; emit the full text once.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
          sent = text;
        }
        if (state.turnStatus === 'refused' || state.turnStatus === 'failed') {
          const reason = state.blockedReason ?? `turn ${state.turnStatus}`;
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: reason })}\n\n`));
        }
        if (state.pendingPermission || state.turnStatus !== 'running') complete();
      };
      if (signal.aborted) {
        close();
        return;
      }
      unsubscribe = subscribe(write);
      signal.addEventListener('abort', close, { once: true });
      write(initial);
    },
  });
}
