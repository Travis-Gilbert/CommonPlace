'use client';

// SOURCING: @assistant-ui/react (AssistantRuntimeProvider + external store
// runtime: the one ambient runtime, named choice 8). The app root: ground
// canvas behind the frame, the shell inside the runtime, the host created
// once per session. Rendered after mount so the persisted arrangement (a
// localStorage-backed surface object) never causes a hydration mismatch.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { ConsoleBlockHost } from '@/lib/console-host';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useThreadStore, type ThreadMessage } from '@/lib/thread-store';
import { useShellStore } from '@/lib/shell-store';
import { ThreadRuntimeAvailable } from '@/views/ThreadView';
import { GroundCanvas } from '@/components/ground/GroundCanvas';
import { IntuiShell } from '@/components/shell/IntuiShell';
import { startAppearanceStore } from '@/lib/appearance-store';

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
      if (!text) return;
      // The /do entry (K3): the composer's slash command opens the action
      // sheet with the instruction pre-filled instead of sending a message.
      if (/^\/do\b/i.test(text)) {
        useShellStore.getState().openActionSheet({
          instruction: text.replace(/^\/do\b/i, '').trim(),
          chips: [],
        });
        return;
      }
      await send(text);
    },
    onCancel: async () => cancel(),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadRuntimeAvailable.Provider value={true}>{children}</ThreadRuntimeAvailable.Provider>
    </AssistantRuntimeProvider>
  );
}

const emptySubscribe = () => () => {};

/** HTTP outcomes from the record wire map onto the named connection states
 *  (R2.3): 403 is the identity-refusal analog, null is a dead transport. */
function connectionFor(status: number | null): 'connected' | 'disconnected' | 'identity-refused' {
  if (status === 403) return 'identity-refused';
  if (status !== null && status >= 200 && status < 300) return 'connected';
  return 'disconnected';
}

export function ConsoleApp() {
  // True after hydration only (server snapshot false): the persisted
  // arrangement in localStorage never causes a hydration mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const setPresence = useShellStore((state) => state.setPresence);

  const host = useMemo(
    () =>
      mounted
        ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
            onTransport: (status) =>
              useShellStore.getState().setConnection(connectionFor(status)),
          })
        : null,
    [mounted],
  );

  useEffect(() => {
    return startAppearanceStore();
  }, []);

  useEffect(() => {
    if (!host) return;
    // Transport health is real: the object-seam probe sets the connection
    // state, and presence renders only when the harness transport reports it.
    void host.probe();
    // Seed the backend's document fixtures once so the Documents surface has
    // editable, persistent content (the file-editing wire).
    void host.ensureSeedContent();
    let active = true;
    void fetch('/api/harness/presence', { cache: 'no-store' })
      .then(async (response) => {
        if (!active || !response.ok) return;
        const payload = (await response.json()) as { count?: number };
        if (typeof payload.count === 'number') setPresence(payload.count);
      })
      .catch(() => {
        // Unconfigured or unreachable harness: presence stays absent.
      });
    return () => {
      active = false;
    };
  }, [host, setPresence]);

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
