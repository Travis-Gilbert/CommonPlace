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
import { HostProvider } from '@/lib/commonplace-host/HostProvider';
import { queryViaBlockHost } from '@/lib/commonplace-host/queryViaBlockHost';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useThreadStore, type ThreadMessage } from '@/lib/thread-store';
import { useShellStore } from '@/lib/shell-store';
import type { ConnectionState } from '@/lib/state/shell-state';
import { submitThreadText } from '@/lib/thread-submit';
import { ThreadRuntimeAvailable } from '@/views/ThreadView';
import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { IntuiShell } from '@/components/shell/IntuiShell';
import { startAppearanceStore } from '@/lib/appearance-store';
import { useWindowInactiveOverlay } from '@/lib/use-window-inactive';
import { useProactivityStore } from '@/lib/proactivity/proactivity-store';
import type { ProactivityGraph } from '@/lib/proactivity/types';
import type { OpenTarget } from '@commonplace/host-bridge';

const LAYOUT_READY_EVENT = 'commonplace:layout-ready';

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
 *  (R2.3 / HANDOFF-PRINCIPAL-CREDENTIALS D5): four causes, one indicator. */
function connectionFor(
  status: number | null,
  error?: string | null,
): ConnectionState {
  if (status === 401 || error === 'principal_resolution=unauthenticated') {
    return 'unauthenticated';
  }
  if (
    error === 'principal_credential_unavailable' ||
    error === 'tenant_object_credential_unavailable'
  ) {
    return 'credential-unavailable';
  }
  if (status === 502 || error === 'console_data_api_unreachable') {
    return 'disconnected';
  }
  if (error === 'workspace_object_scope_unenforced') {
    return 'disconnected';
  }
  if (status === 403) return 'identity-refused';
  if (status !== null && status >= 200 && status < 300) return 'connected';
  return 'disconnected';
}

export function ConsoleApp({
  initialProactivity,
  initialTenant,
}: {
  initialProactivity?: { readonly graph: ProactivityGraph | null; readonly error: string | null };
  initialTenant?: string | null;
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
  useWindowInactiveOverlay();

  const host = useMemo(
    () =>
      mounted
        ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
            // The server resolves this from the authenticated principal. Null
            // refuses local proactivity state instead of sharing a default.
            proactivityTenant: initialTenant ?? null,
            onTransport: (status, error) =>
              useShellStore.getState().setConnection(connectionFor(status, error)),
          })
        : null,
    [initialTenant, mounted],
  );

  const onOpenTarget = useMemo(
    () => async (target: OpenTarget) => {
      if (target.kind === 'url' && typeof window !== 'undefined') {
        window.open(target.url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (target.kind === 'find') {
        useShellStore.getState().openSearchPanel('search');
        return;
      }
      if (target.kind === 'ask') {
        useShellStore.getState().openSearchPanel('command');
        return;
      }
      if (target.kind === 'block') {
        useShellStore.getState().selectRecord(target.blockId, null, 'note');
      }
    },
    [],
  );

  const queryObjects = useMemo(() => {
    if (!host) return undefined;
    return (q: Parameters<typeof queryViaBlockHost>[1]) => queryViaBlockHost(host, q);
  }, [host]);

  useEffect(() => {
    return startAppearanceStore();
  }, []);

  useEffect(() => {
    if (!initialProactivity) return;
    if (initialProactivity.graph) hydrateProactivity(initialProactivity.graph);
    else failProactivity(initialProactivity.error ?? 'server_projection_unavailable');
  }, [failProactivity, hydrateProactivity, initialProactivity]);

  useEffect(() => {
    if (!host) return;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-layout-ready', '0');
    }
    // Transport health is real: the object-seam probe sets the connection
    // state, and presence renders only when the harness transport reports it.
    void host.probe();
    // Seed the backend's document fixtures once so the Documents surface has
    // editable, persistent content (the file-editing wire).
    void host.ensureSeedContent();
    // B6: layouts as data. Adopt server arrangement or push the local seed.
    let active = true;
    void host.ensureSeedLayout().finally(() => {
      if (!active || typeof document === 'undefined') return;
      document.documentElement.setAttribute('data-layout-ready', '1');
      window.dispatchEvent(new Event(LAYOUT_READY_EVENT));
    });
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
    <div className="relative h-dvh w-full overflow-hidden bg-ij-frame" data-console-frame>
      <MaterialLayer />
      <div className="relative z-10 h-full">
        <HostProvider queryObjects={queryObjects} onOpenTarget={onOpenTarget}>
          <SessionProvider>
            <RuntimeBoundary>
              <IntuiShell host={host} />
            </RuntimeBoundary>
          </SessionProvider>
        </HostProvider>
      </div>
    </div>
  );
}
