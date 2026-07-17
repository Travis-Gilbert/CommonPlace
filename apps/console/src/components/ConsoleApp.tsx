'use client';

// SOURCING: @assistant-ui/react (AssistantRuntimeProvider + external store
// runtime: the one ambient runtime, named choice 8). The app root: ground
// canvas behind the frame, the shell inside the runtime, the host created
// once per session. Rendered after mount so the persisted arrangement (a
// localStorage-backed surface object) never causes a hydration mismatch.

import { useEffect, useMemo, useState } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { ConsoleBlockHost } from '@/lib/console-host';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useThreadStore, chatEndpoint, type ThreadMessage } from '@/lib/thread-store';
import { useShellStore } from '@/lib/shell-store';
import { ThreadRuntimeAvailable } from '@/views/ThreadView';
import { GroundCanvas } from '@/components/ground/GroundCanvas';
import { IntuiShell } from '@/components/shell/IntuiShell';

function convertMessage(message: ThreadMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.map((part) => ({ type: 'text' as const, text: part.text })),
  };
}

function appendedText(message: AppendMessage): string {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim();
}

function RuntimeBoundary({ children }: { children: React.ReactNode }) {
  const messages = useThreadStore((state) => state.messages);
  const isRunning = useThreadStore((state) => state.isRunning);
  const send = useThreadStore((state) => state.send);
  const cancel = useThreadStore((state) => state.cancel);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew: async (message: AppendMessage) => {
      const text = appendedText(message);
      if (text) await send(text);
    },
    onCancel: async () => cancel(),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadRuntimeAvailable.Provider value={true}>{children}</ThreadRuntimeAvailable.Provider>
    </AssistantRuntimeProvider>
  );
}

export function ConsoleApp() {
  const [mounted, setMounted] = useState(false);
  const setConnection = useShellStore((state) => state.setConnection);

  useEffect(() => {
    setMounted(true);
    // Connection state is real: with no chat endpoint configured the console
    // is disconnected; a configured endpoint marks the session connected.
    setConnection(chatEndpoint() ? 'connected' : 'disconnected');
  }, [setConnection]);

  const host = useMemo(
    () => (mounted ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY) : null),
    [mounted],
  );

  if (!mounted || !host) {
    return <div className="h-dvh w-full bg-ij-frame" aria-busy="true" />;
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ij-frame">
      <GroundCanvas />
      <div className="relative z-10 h-full p-1">
        <RuntimeBoundary>
          <div className="h-full overflow-hidden rounded-ij-arc border border-ij-seam">
            <IntuiShell host={host} />
          </div>
        </RuntimeBoundary>
      </div>
    </div>
  );
}
