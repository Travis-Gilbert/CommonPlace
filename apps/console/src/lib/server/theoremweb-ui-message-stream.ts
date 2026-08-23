// SOURCING: Vercel AI SDK 5 UIMessageChunk wire contract and the existing
// @commonplace/theorem-acp managed-session state. This is a protocol adapter:
// it does not own a second agent runtime or synthesize model/tool events.

import type { AcquiredAcpSession } from '@commonplace/theorem-acp/session-manager';
import type {
  BridgeToolCall,
  TheoremAgentMessage,
  TheoremAgentState,
} from '@commonplace/theorem-acp/state';
import type { WebResearchSource } from '@/lib/web-research-contract';

export const UI_MESSAGE_STREAM_PROTOCOL = 'v1';

type JsonObject = Record<string, unknown>;

export type TheoremUiMessageStreamOptions = {
  readonly session: AcquiredAcpSession;
  readonly sources: readonly WebResearchSource[];
  readonly signal: AbortSignal;
  readonly start: () => Promise<void>;
  readonly tenant: string;
};

export function theoremUiMessageStreamHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'x-vercel-ai-ui-message-stream': UI_MESSAGE_STREAM_PROTOCOL,
  });
}

/**
 * Adapt one managed ACP turn to the AI SDK 5 UI-message SSE protocol.
 *
 * ACP state is cumulative. The adapter therefore tracks emitted offsets and
 * identities so every model/tool update is written exactly once.
 */
export function createTheoremUiMessageStream(
  options: TheoremUiMessageStreamOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cancelStream: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const initial = options.session.getState();
      const sessionId = initial.sessionId ?? crypto.randomUUID();
      const messageId = `theorem-${sessionId}`;
      const textId = `text-${messageId}`;
      const reasoningId = `reasoning-${messageId}`;
      const sentToolInputs = new Set<string>();
      const sentToolOutputs = new Set<string>();
      const sentApprovals = new Set<string>();
      let sentText = '';
      let sentContributions = 0;
      let textStarted = false;
      let reasoningStarted = false;
      let turnStarted = false;
      let closed = false;
      let unsubscribe = () => {};

      const write = (part: JsonObject) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(part)}\n\n`));
        } catch {
          cancel();
        }
      };

      const finishOpenParts = () => {
        if (reasoningStarted) {
          write({ type: 'reasoning-end', id: reasoningId });
          reasoningStarted = false;
        }
        if (textStarted) {
          write({ type: 'text-end', id: textId });
          textStarted = false;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        options.signal.removeEventListener('abort', cancel);
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch {
          // The response consumer already cancelled the body.
        }
      };

      const abort = (reason: string) => {
        if (closed) return;
        finishOpenParts();
        write({ type: 'abort', reason });
        close();
      };

      const cancel = () => {
        if (closed) return;
        void options.session.cancel().catch(() => {});
        abort('client cancel');
      };
      cancelStream = cancel;

      const emitToolInput = (toolCall: BridgeToolCall) => {
        if (sentToolInputs.has(toolCall.callId)) return;
        sentToolInputs.add(toolCall.callId);
        write({
          type: 'tool-input-available',
          toolCallId: toolCall.callId,
          toolName: toolCall.name,
          input: toolCall.rawInput,
        });
      };

      const emitAssistant = (assistant: TheoremAgentMessage | undefined) => {
        if (!assistant) return;
        for (const contribution of assistant.contributions.slice(sentContributions)) {
          if (!reasoningStarted) {
            reasoningStarted = true;
            write({ type: 'reasoning-start', id: reasoningId });
          }
          if (contribution.summary) {
            write({
              type: 'reasoning-delta',
              id: reasoningId,
              delta: contribution.summary,
            });
          }
        }
        sentContributions = assistant.contributions.length;

        if (assistant.text.startsWith(sentText) && assistant.text.length > sentText.length) {
          if (!textStarted) {
            textStarted = true;
            write({ type: 'text-start', id: textId });
          }
          write({
            type: 'text-delta',
            id: textId,
            delta: assistant.text.slice(sentText.length),
          });
          sentText = assistant.text;
        } else if (!assistant.text.startsWith(sentText) && assistant.text) {
          if (!textStarted) {
            textStarted = true;
            write({ type: 'text-start', id: textId });
          }
          write({ type: 'text-delta', id: textId, delta: assistant.text });
          sentText = assistant.text;
        }

        for (const toolCall of assistant.toolCalls) {
          emitToolInput(toolCall);
          if (toolCall.status === 'completed' && !sentToolOutputs.has(toolCall.callId)) {
            sentToolOutputs.add(toolCall.callId);
            write({
              type: 'tool-output-available',
              toolCallId: toolCall.callId,
              output: toolCall.rawOutput ?? null,
            });
          }
        }
      };

      const emitState = (state: TheoremAgentState) => {
        if (closed || !turnStarted) return;
        const assistant = [...state.messages]
          .reverse()
          .find((message) => message.role === 'assistant');
        emitAssistant(assistant);

        const permission = state.pendingPermission;
        if (permission) {
          emitToolInput({
            callId: permission.callId,
            name: permission.name,
            rawInput: permission.rawInput,
            status: 'pending',
          });
          if (!sentApprovals.has(permission.callId)) {
            sentApprovals.add(permission.callId);
            write({
              type: 'tool-approval-request',
              approvalId: `approval-${permission.callId}`,
              toolCallId: permission.callId,
            });
          }
        }

        if (permission || state.turnStatus !== 'running') {
          finishOpenParts();
          if (state.turnStatus === 'failed' || state.turnStatus === 'refused') {
            write({
              type: 'error',
              errorText:
                state.error ?? state.blockedReason ?? `The turn ${state.turnStatus}.`,
            });
          }
          write({ type: 'finish-step' });
          write({
            type: 'finish',
            finishReason: permission
              ? 'tool-calls'
              : finishReason(state.turnStatus),
            messageMetadata: {
              sessionId: state.sessionId,
              turnStatus: state.turnStatus,
            },
          });
          close();
        }
      };

      write({
        type: 'start',
        messageId,
        messageMetadata: {
          sessionId: initial.sessionId,
          mode: initial.mode,
          bindingId: initial.bindingId,
        },
      });
      write({ type: 'start-step' });
      write({
        type: 'data-theorem-run',
        data: {
          schema_version: 'theorem-ui-message-run/1',
          session_id: initial.sessionId,
          mode: initial.mode,
          binding_id: initial.bindingId,
          tenant: options.tenant,
          source_count: options.sources.length,
        },
      });
      options.sources.forEach((source, index) => {
        write({
          type: 'source-url',
          sourceId: `rustyweb-${index + 1}`,
          url: source.url,
          title: source.title,
          providerMetadata: { theorem: { provider: source.provider } },
        });
      });

      unsubscribe = options.session.subscribe(emitState);
      if (options.signal.aborted) {
        cancel();
        return;
      }
      options.signal.addEventListener('abort', cancel, { once: true });
      turnStarted = true;
      void options.start()
        .then(() => emitState(options.session.getState()))
        .catch((error: unknown) => {
          if (closed) return;
          finishOpenParts();
          write({
            type: 'error',
            errorText: error instanceof Error ? error.message : 'The agent turn failed to start.',
          });
          write({ type: 'finish-step' });
          write({ type: 'finish', finishReason: 'error' });
          close();
        });
    },
    cancel() {
      cancelStream?.();
    },
  });
}

function finishReason(
  status: TheoremAgentState['turnStatus'],
): 'stop' | 'error' | 'other' {
  if (status === 'complete') return 'stop';
  if (status === 'failed' || status === 'refused') return 'error';
  return 'other';
}
