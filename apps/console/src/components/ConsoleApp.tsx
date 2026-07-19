'use client';

// SOURCING: @assistant-ui/react (AssistantRuntimeProvider + external store
// runtime: the one ambient runtime, named choice 8). The app root: ground
// canvas behind the frame, the shell inside the runtime, the host created
// once per session. Rendered after mount so the persisted arrangement (a
// localStorage-backed surface object) never causes a hydration mismatch.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { SessionProvider } from 'next-auth/react';
import { ConsoleBlockHost } from '@/lib/console-host';
import { FIXTURE_TENANT } from '@/lib/proactivity/fixtures';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useThreadStore, type ThreadMessage } from '@/lib/thread-store';
import { useShellStore } from '@/lib/shell-store';
import { submitThreadText } from '@/lib/thread-submit';
import { ThreadRuntimeAvailable } from '@/views/ThreadView';
import { GroundCanvas } from '@/components/ground/GroundCanvas';
import { IntuiShell } from '@/components/shell/IntuiShell';
import { startAppearanceStore } from '@/lib/appearance-store';
import { useProactivityStore } from '@/lib/proactivity/proactivity-store';
import type { ProactivityGraph } from '@/lib/proactivity/types';

const ATTACHMENT_ADAPTER = new CompositeAttachmentAdapter([
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
]);

function convertMessage(message: ThreadMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: message.parts.map((part) => ({ type: 'text' as const, text: part.text })),
    metadata: { custom: message.degradation ? { degradation: message.degradation } : {} },
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
  const cancel = useThreadStore((state) => state.cancel);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    convertMessage,
    onNew: async (message: AppendMessage) => {
      const text = appendedText(message);
      if (!text) return;
      await submitThreadText(text);
    },
    onCancel: async () => cancel(),
    adapters: { attachments: ATTACHMENT_ADAPTER },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadRuntimeAvailable.Provider value={true}>{children}</ThreadRuntimeAvailable.Provider>
    </AssistantRuntimeProvider>
  );
}

const emptySubscribe = () => () => {};

/** HTTP outcomes from the record wire map onto the named connection states
 *  (R2.3): 401 and 403 are identity-refusal outcomes, null is a dead transport. */
function connectionFor(status: number | null): 'connected' | 'disconnected' | 'identity-refused' {
  if (status === 401 || status === 403) return 'identity-refused';
  if (status !== null && status >= 200 && status < 300) return 'connected';
  return 'disconnected';
}

export function ConsoleApp({
  initialProactivity,
}: {
  initialProactivity?: { readonly graph: ProactivityGraph | null; readonly error: string | null };
} = {}) {
  // True after hydration only (server snapshot false): the persisted
  // arrangement in localStorage never causes a hydration mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const setPresence = useShellStore((state) => state.setPresence);
  const hydrateProactivity = useProactivityStore((state) => state.hydrate);
  const failProactivity = useProactivityStore((state) => state.fail);

  const host = useMemo(
    () =>
      mounted
        ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
            // Fixture seam until session tenant resolution wires through: pass
            // FIXTURE_TENANT explicitly so an omitted tenant cannot share state.
            proactivityTenant: FIXTURE_TENANT,
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
    if (initialProactivity.graph) hydrateProactivity(initialProactivity.graph);
    else failProactivity(initialProactivity.error ?? 'server_projection_unavailable');
  }, [failProactivity, hydrateProactivity, initialProactivity]);

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
        <SessionProvider>
          <RuntimeBoundary>
            <div className="h-full overflow-hidden rounded-ij-arc border border-ij-seam">
              <IntuiShell host={host} />
            </div>
          </RuntimeBoundary>
        </SessionProvider>
      </div>
    </div>
  );
}
