// SOURCING: @commonplace/theorem-acp/state. The ACP session manager maintains
// this reducer state; this adapter turns its cumulative snapshots into review
// deltas plus one pending-compilation event. It does not create a second run
// protocol.

import type { TheoremAgentState } from '@commonplace/theorem-acp/state';
import type { PendingProactivityCompilation } from './types';

export type CompilationFinalizer = (text: string) => Promise<PendingProactivityCompilation>;

/** Stream the existing ACP state reducer to the Console. Only a successful,
 * validated final model result is staged, and it remains pending review. */
export function proactivityCompilationStream(
  subscribe: (listener: (state: TheoremAgentState) => void) => () => void,
  initial: TheoremAgentState,
  signal: AbortSignal,
  finalize: CompilationFinalizer,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let finalizing = false;
      let sent = '';
      let unsubscribe = () => {};
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        signal.removeEventListener('abort', close);
        try {
          controller.close();
        } catch {
          // The runtime may already have closed the response body.
        }
      };
      const write = (state: TheoremAgentState) => {
        if (closed) return;
        const assistant = [...state.messages].reverse().find((message) => message.role === 'assistant');
        const text = assistant?.text ?? '';
        if (text.startsWith(sent) && text.length > sent.length) {
          const delta = text.slice(sent.length);
          sent = text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        } else if (!text.startsWith(sent) && text.length > 0) {
          sent = text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
        }
        if (state.turnStatus === 'running' && !state.pendingPermission) return;
        if (finalizing) return;
        finalizing = true;
        void complete(state, text);
      };
      const complete = async (state: TheoremAgentState, text: string) => {
        if (closed) return;
        if (state.turnStatus === 'refused' || state.turnStatus === 'failed' || state.pendingPermission) {
          const error = state.blockedReason ?? 'Proactivity compilation did not complete.';
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`));
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          close();
          return;
        }
        try {
          const pending = await finalize(text);
          if (closed) return;
          controller.enqueue(encoder.encode(`event: compilation\ndata: ${JSON.stringify(pending)}\n\n`));
        } catch (error) {
          if (!closed) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
              error: error instanceof Error ? error.message : 'Proactivity compilation could not be staged.',
            })}\n\n`));
          }
        }
        if (!closed) controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
        close();
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
