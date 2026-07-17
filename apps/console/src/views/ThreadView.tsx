'use client';

// SOURCING: @assistant-ui/react (thread, composer, message primitives) +
// @assistant-ui/react-markdown (markdown in messages). The chat.thread
// descriptor (G7): renders the assistant-ui thread from the ambient runtime
// the shell provides; outside a runtime it degrades to the fallback card.
// The Presence mark is the composing indicator; no other typing affordance
// or spinner exists on any agent path. Streaming text never participates in
// layout animation.

import { createContext, useContext } from 'react';
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { motion } from 'motion/react';
import { useThreadStore, chatEndpoint } from '@/lib/thread-store';
import { DUR, EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { ViewState } from './ViewStates';

/** Set true by ConsoleApp inside AssistantRuntimeProvider; the descriptor
 *  degrades to the fallback card when mounted outside one. */
export const ThreadRuntimeAvailable = createContext(false);

function MessageShell({ children }: { children: React.ReactNode }) {
  const durations = useMotionDurations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: seconds(durations.base), ease: EASE_OUT }}
      className="px-3 py-2"
    >
      {children}
    </motion.div>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root>
      <MessageShell>
        <div className="ml-8 rounded-ij-arc bg-ij-raised px-3 py-2 text-ij-ink">
          <MessagePrimitive.Parts />
        </div>
      </MessageShell>
    </MessagePrimitive.Root>
  );
}

function MarkdownText() {
  return <MarkdownTextPrimitive />;
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root>
      <MessageShell>
        <div className="mr-8 px-1 text-ij-ink">
          <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
        </div>
      </MessageShell>
    </MessagePrimitive.Root>
  );
}

export function ThreadView() {
  const runtimeAvailable = useContext(ThreadRuntimeAvailable);
  const isRunning = useThreadStore((state) => state.isRunning);
  const error = useThreadStore((state) => state.error);
  const endpoint = chatEndpoint();

  if (!runtimeAvailable) {
    return (
      <div className="m-3 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-4 text-ij-ink-info">
        Thread unavailable outside an assistant runtime.
      </div>
    );
  }

  if (!endpoint) {
    return (
      <ViewState
        state="unavailable"
        capability="the harness chat endpoint (NEXT_PUBLIC_CONSOLE_CHAT_URL)"
      />
    );
  }

  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-ij-chrome">
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
        <ThreadPrimitive.Empty>
          <div className="flex h-full items-center justify-center p-6 text-ij-ink-info">
            Ask the harness.
          </div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
        {isRunning ? (
          <div className="flex items-center gap-2 px-4 py-1" aria-live="polite">
            <PresenceMark state="composing" size={28} />
            <span className="sr-only">Assistant is composing</span>
          </div>
        ) : null}
        {error ? <div className="px-4 py-1 text-ij-error">{error}</div> : null}
      </ThreadPrimitive.Viewport>
      <ComposerPrimitive.Root className="flex shrink-0 items-end gap-2 border-t border-ij-seam p-2">
        <ComposerPrimitive.Input
          rows={1}
          placeholder="Message the harness"
          className="max-h-40 min-h-ij-control flex-1 resize-none rounded-ij-arc border border-ij-control-border bg-ij-editor px-3 py-1 text-ij-ink placeholder:text-ij-ink-disabled focus:outline-2 focus:outline-ij-accent"
        />
        {isRunning ? (
          <ComposerPrimitive.Cancel
            className="h-ij-control rounded-ij-arc bg-ij-raised px-3 text-ij-ink hover:bg-ij-hover-surface"
          >
            Stop
          </ComposerPrimitive.Cancel>
        ) : (
          <ComposerPrimitive.Send className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover">
            Send
          </ComposerPrimitive.Send>
        )}
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}
