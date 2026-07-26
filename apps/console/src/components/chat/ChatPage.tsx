'use client';

// SOURCING: none. CH1: Chat is a page, not an arrangement. No ViewInstanceHost,
// no descriptor lookup, no BlockArrangementHost.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { SessionProvider } from 'next-auth/react';
import type { BlockHost } from '@commonplace/block-view/types';
import { ConsoleBlockHost } from '@/lib/console-host';
import { HostProvider } from '@/lib/commonplace-host/HostProvider';
import { queryViaBlockHost } from '@/lib/commonplace-host/queryViaBlockHost';
import { FIXTURE_TENANT } from '@/lib/proactivity/fixtures';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useShellStore } from '@/lib/shell-store';
import type { ConnectionState } from '@/lib/state/shell-state';
import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { ChatSidebar, type CapabilityItem } from '@/components/chat/ChatSidebar';
import { Transcript } from '@/components/chat/Transcript';
import { Composer, useChatAttachments } from '@/components/chat/Composer';
import { ChatRail } from '@/components/chat/ChatRail';
import { ChatDropProvider } from '@/components/chat/ChatDropOverlay';
import { useChatPageRuntime } from '@/components/chat/runtime';
import type { ChatCatalog, ChatThreadRecord } from '@/lib/chat/project-types';
import {
  createChatThread,
  fetchChatCatalog,
  fetchChatThread,
  persistChatMessages,
  persistChatThread,
} from '@/lib/chat/catalog-client';
import { degradationFor } from '@/lib/degradation';
import { cn } from '@/lib/cn';

const emptySubscribe = () => () => {};

function connectionFor(status: number | null, error?: string | null): ConnectionState {
  if (status === 401 || error === 'principal_resolution=unauthenticated') return 'unauthenticated';
  if (
    error === 'principal_credential_unavailable'
    || error === 'tenant_object_credential_unavailable'
  ) {
    return 'credential-unavailable';
  }
  if (status === 502 || error === 'console_data_api_unreachable') return 'disconnected';
  if (status === 403) return 'identity-refused';
  if (status !== null && status >= 200 && status < 300) return 'connected';
  return 'disconnected';
}

function RuntimeTree({
  host,
  thread,
  unreachable,
  attachments,
  wide,
  railCollapsed,
  onToggleCollapse,
}: {
  host: BlockHost;
  thread: ChatThreadRecord;
  unreachable: boolean;
  attachments: ReturnType<typeof useChatAttachments>;
  wide: boolean;
  railCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const runtime = useChatPageRuntime({
    threadId: thread.id,
    sessionId: thread.sessionId,
    capability: thread.capability,
    initialMessages: thread.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: [{ type: 'text' as const, text: message.text }],
      status: message.incomplete
        ? { type: 'incomplete' as const, reason: 'error' as const }
        : { type: 'complete' as const, reason: 'stop' as const },
    })),
  });

  useEffect(() => {
    // Persist turns mirrored into jotai whenever the transport finishes a run.
    const timer = window.setInterval(() => {
      void import('@/lib/thread-store').then(({ useThreadStore }) => {
        const state = useThreadStore.getState();
        if (state.isRunning) return;
        if (state.messages.length === 0) return;
        void persistChatMessages(
          thread.id,
          state.messages.map((message) => ({
            id: message.id,
            role: message.role,
            text: message.parts.map((part) => part.text).join(''),
            incomplete: Boolean(state.error),
          })),
        ).catch(() => {});
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [thread.id]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1 flex-col',
          wide && !railCollapsed && 'pr-0',
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <Transcript
            host={host}
            threadId={thread.id}
            initialScrollTop={thread.scrollTop}
            unreachable={unreachable}
          />
          <div className="mx-auto w-[70ch] max-w-[74ch] min-w-[68ch] max-[900px]:min-w-0 max-[900px]:w-full shrink-0 px-4 pb-4">
            <Composer
              unreachable={unreachable}
              attachmentApi={attachments}
            />
          </div>
        </div>
      </main>
      {/* Rail must sit inside the provider: AgentRailBlock embeds the shell
          Composer, which requires ComposerRuntime. */}
      {wide ? (
        <ChatRail
          host={host}
          collapsed={railCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      ) : (
        <>
          {!railCollapsed ? (
            <button
              type="button"
              aria-label="Close agent rail"
              className="absolute inset-0 z-20 bg-ij-frame/50"
              onClick={onToggleCollapse}
            />
          ) : null}
          <div
            className={cn(
              'absolute right-0 top-0 z-30 h-full',
              railCollapsed ? 'w-8' : 'w-[min(320px,90vw)]',
            )}
          >
            <ChatRail
              host={host}
              collapsed={railCollapsed}
              onToggleCollapse={onToggleCollapse}
            />
          </div>
        </>
      )}
    </AssistantRuntimeProvider>
  );
}

export function ChatPage({ threadId }: { threadId?: string }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const connection = useShellStore((state) => state.connection);
  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [thread, setThread] = useState<ChatThreadRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [wide, setWide] = useState(true);
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const attachments = useChatAttachments();

  const host = useMemo(
    () =>
      mounted
        ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
            proactivityTenant: FIXTURE_TENANT,
            onTransport: (status, error) =>
              useShellStore.getState().setConnection(connectionFor(status, error)),
          })
        : null,
    [mounted],
  );

  const queryObjects = useMemo(() => {
    if (!host) return undefined;
    return (q: Parameters<typeof queryViaBlockHost>[1]) => queryViaBlockHost(host, q);
  }, [host]);

  useEffect(() => {
    if (!mounted) return;
    const media = window.matchMedia('(min-width: 1100px)');
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [mounted]);

  useEffect(() => {
    if (!host) return;
    void host.probe();
  }, [host]);

  useEffect(() => {
    let active = true;
    void fetchChatCatalog()
      .then((next) => {
        if (active) setCatalog(next);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'catalog_unreachable');
        }
      });
    // Capabilities API currently exposes web search only; packs/skills land
    // when the instance advertises them. Empty list is honest absence.
    setCapabilities([]);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    let active = true;
    const run = async () => {
      try {
        if (threadId) {
          const loaded = await fetchChatThread(threadId);
          if (!active) return;
          setThread(loaded);
          setRailCollapsed(loaded.railCollapsed);
          return;
        }
        const existing = catalog.threads.find(
          (item) => item.projectId === catalog.activeProjectId,
        );
        if (existing) {
          router.replace(`/chat/${existing.id}`);
          return;
        }
        const created = await createChatThread({
          projectId: catalog.activeProjectId ?? undefined,
          title: 'New thread',
        });
        if (!active) return;
        setCatalog({ ...catalog, threads: [created, ...catalog.threads] });
        router.replace(`/chat/${created.id}`);
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'thread_unreachable');
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [catalog, threadId, router]);

  const unreachable =
    connection === 'disconnected'
    || loadError != null;

  const toggleRail = useCallback(() => {
    setRailCollapsed((current) => {
      const next = !current;
      if (thread) {
        void persistChatThread(thread.id, { railCollapsed: next }).catch(() => {});
      }
      return next;
    });
  }, [thread]);

  const onOpenThread = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
    },
    [router],
  );

  if (!mounted || !host) {
    return <div className="h-dvh w-full bg-ij-frame" aria-busy="true" />;
  }

  const degradation = loadError
    ? degradationFor('console_data_api_unreachable')
    : connection === 'disconnected'
      ? degradationFor('console_data_api_unreachable')
      : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ij-frame" data-chat-page>
      <MaterialLayer />
      <div className="relative z-10 h-full">
        <HostProvider queryObjects={queryObjects}>
          <SessionProvider>
            <ChatDropProvider
              onFiles={(files) => attachments.addFiles(files)}
              onObjectRef={(ref) => attachments.stageObjectRef(ref)}
            >
              <div className="relative flex h-full min-h-0">
                {catalog ? (
                  <ChatSidebar
                    catalog={catalog}
                    activeThreadId={thread?.id ?? null}
                    capabilities={capabilities}
                    unreachable={unreachable}
                    onCatalogChange={setCatalog}
                    onOpenThread={onOpenThread}
                  />
                ) : (
                  <aside className="w-[min(280px,36vw)] border-r border-ij-seam p-3 text-ij-ink-info">
                    {degradation ? degradation.cause : 'Loading projects…'}
                  </aside>
                )}

                {thread ? (
                  <RuntimeTree
                    host={host}
                    thread={thread}
                    unreachable={unreachable}
                    attachments={attachments}
                    wide={wide}
                    railCollapsed={railCollapsed}
                    onToggleCollapse={toggleRail}
                  />
                ) : (
                  <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex flex-1 items-center justify-center text-ij-ink-info" role="status">
                      {degradation ? degradation.cause : 'Opening thread…'}
                    </div>
                  </main>
                )}
              </div>
            </ChatDropProvider>
          </SessionProvider>
        </HostProvider>
      </div>
    </div>
  );
}
