'use client';

// SOURCING: none. CH1: Chat is a page, not an arrangement.
// SPEC-COMMONPLACE-CHAT-SHELL-1.2: one composer, event-driven persistence,
// shared measure, artifacts wired, rail without input.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { SessionProvider } from 'next-auth/react';
import type { BlockHost } from '@commonplace/block-view/types';
import { ConsoleBlockHost } from '@/lib/console-host';
import { HostProvider } from '@/lib/commonplace-host/HostProvider';
import { queryViaBlockHost } from '@/lib/commonplace-host/queryViaBlockHost';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import { useShellStore } from '@/lib/shell-store';
import type { ConnectionState } from '@/lib/state/shell-state';
import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { ChatSidebar, type CapabilityItem } from '@/components/chat/ChatSidebar';
import { Transcript } from '@/components/chat/Transcript';
import { Composer, useChatAttachments } from '@/components/chat/Composer';
import {
  CHAT_INSPECTOR_SECTIONS,
  InspectorRail,
} from '@/components/shell/InspectorRail';
import { ChatDropProvider } from '@/components/chat/ChatDropOverlay';
import { useChatPageRuntime } from '@/components/chat/runtime';
import type { ChatArtifactPayload, ChatCatalog, ChatThreadRecord } from '@/lib/chat/project-types';
import {
  createChatThread,
  fetchChatCatalog,
  fetchChatThread,
  persistChatMessages,
  persistChatThread,
} from '@/lib/chat/catalog-client';
import { CHAT_MEASURE } from '@/lib/chat/measure';
import {
  type ContextEntry,
  type ContextFolder,
  type ContextProvenance,
} from '@/lib/chat/context-types';
import { degradationFor } from '@/lib/degradation';
import { useRoomEvents } from '@/lib/events/use-room-events';
import { threadMessagesForPersistence, useThreadStore } from '@/lib/thread-store';
import { cn } from '@/lib/cn';

const emptySubscribe = () => () => {};
const MESSAGE_PERSIST_DEBOUNCE_MS = 500;

function connectionFor(status: number | null, error?: string | null): ConnectionState {
  if (status === 401 || error === 'principal_resolution=unauthenticated') return 'unauthenticated';
  if (
    error === 'principal_credential_unavailable'
    || error === 'tenant_object_credential_unavailable'
  ) {
    return 'credential-unavailable';
  }
  if (status === 502 || error === 'console_data_api_unreachable') return 'disconnected';
  if (error === 'workspace_object_scope_unenforced') return 'disconnected';
  if (status === 403) return 'identity-refused';
  if (status !== null && status >= 200 && status < 300) return 'connected';
  return 'disconnected';
}

function artifactsFromThread(thread: ChatThreadRecord): Record<string, ChatArtifactPayload[]> {
  const map: Record<string, ChatArtifactPayload[]> = {};
  for (const message of thread.messages) {
    if (message.artifact) {
      map[message.id] = [message.artifact];
    }
  }
  return map;
}

function foldersFromProject(
  thread: ChatThreadRecord,
  catalog: ChatCatalog,
  overrides: ReadonlyMap<string, boolean>,
  docLabels: ReadonlyMap<string, string> = new Map(),
): ContextFolder[] {
  const project = catalog.projects.find((item) => item.id === thread.projectId);
  if (!project) return [];

  const makeEntry = (
    id: string,
    label: string,
    provenance: ContextProvenance,
    unavailable = false,
  ): ContextEntry => ({
    id,
    label,
    provenance,
    included: overrides.has(id) ? Boolean(overrides.get(id)) : true,
    unavailable,
  });

  const documents: ContextEntry[] = project.documentIds.map((id) =>
    makeEntry(
      `doc:${id}`,
      docLabels.get(id) ?? id,
      'user',
      Boolean(docLabels.size > 0 && !docLabels.has(id)),
    ),
  );
  const types: ContextEntry[] = project.objectTypes.map((type) =>
    makeEntry(`type:${type}`, type, 'retrieved'),
  );

  // Honest empty-vs-unreachable: a project with declared docs that cannot be
  // resolved still names provenance rather than inventing children.
  const folders: ContextFolder[] = [
    {
      id: 'folder:documents',
      label: 'Documents',
      entries: documents,
      unavailable: false,
    },
    {
      id: 'folder:types',
      label: 'Object types',
      entries: types,
    },
    {
      id: 'folder:encoded',
      label: 'Encoded',
      entries: thread.capability
        ? [makeEntry(`cap:${thread.capability.id}`, thread.capability.name, 'encoded')]
        : [],
    },
    {
      id: 'folder:data-science',
      label: 'Data science',
      entries: [],
      unavailable: false,
    },
  ];

  if (documents.length === 0 && project.documentIds.length > 0) {
    folders[0] = {
      id: 'folder:documents',
      label: 'Documents',
      entries: [],
      unavailable: true,
    };
  }

  return folders;
}

function RuntimeTree({
  host,
  thread,
  unreachable,
  attachments,
  artifactsByMessage,
}: {
  host: BlockHost;
  thread: ChatThreadRecord;
  unreachable: boolean;
  attachments: ReturnType<typeof useChatAttachments>;
  artifactsByMessage: Readonly<Record<string, readonly ChatArtifactPayload[]>>;
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
  useRoomEvents(thread.sessionId);

  const persistTimer = useRef<number | null>(null);

  const writeMessages = useCallback(() => {
    const state = useThreadStore.getState();
    if (state.messages.length === 0) return;
    void persistChatMessages(
      thread.id,
      threadMessagesForPersistence(state.messages, Boolean(state.error)),
    ).catch(() => {});
  }, [thread.id]);

  useEffect(() => {
    // SH3: subscribe to the thread store. Persist on transition out of running,
    // plus a debounced write on message mutation. No interval polling.
    const unsubscribe = useThreadStore.subscribe((state, prev) => {
      if (prev.isRunning && !state.isRunning) {
        writeMessages();
        return;
      }

      if (state.messages === prev.messages) return;
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        if (useThreadStore.getState().isRunning) return;
        writeMessages();
      }, MESSAGE_PERSIST_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    };
  }, [writeMessages]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex min-h-0 flex-1 flex-col">
        <Transcript
          host={host}
          threadId={thread.id}
          initialScrollTop={thread.scrollTop}
          artifactsByMessage={artifactsByMessage}
          unreachable={unreachable}
        />
        <div className={cn(CHAT_MEASURE, 'shrink-0 px-4 pb-4')}>
          <Composer
            unreachable={unreachable}
            attachmentApi={attachments}
          />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

export function ChatPage({
  threadId,
  tenant,
}: {
  readonly threadId?: string;
  readonly tenant?: string | null;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const connection = useShellStore((state) => state.connection);
  const [catalog, setCatalog] = useState<ChatCatalog | null>(null);
  const [thread, setThread] = useState<ChatThreadRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Inspector rail collapsed by default (discoverable via layers edge control). */
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const [includeOverrides, setIncludeOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [capabilities, setCapabilities] = useState<readonly CapabilityItem[]>([]);
  const [docLabels, setDocLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const attachments = useChatAttachments();

  const host = useMemo(
    () =>
      mounted
        ? new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {
            proactivityTenant: tenant ?? null,
            onTransport: (status, error) =>
              useShellStore.getState().setConnection(connectionFor(status, error)),
          })
        : null,
    [mounted, tenant],
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
    void fetch('/api/capabilities', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return [] as CapabilityItem[];
        const body = (await response.json()) as { web_search?: unknown };
        return body.web_search === true
          ? [{ kind: 'skill' as const, id: 'web_search', name: 'Web search' }]
          : [];
      })
      .then((next) => {
        if (active) setCapabilities(next);
      })
      .catch(() => {
        if (active) setCapabilities([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!host || !catalog) return;
    const documentIds = new Set(
      catalog.projects.flatMap((project) => project.documentIds),
    );
    if (documentIds.size === 0) {
      setDocLabels(new Map());
      return;
    }
    let active = true;
    void Promise.resolve(host.query({
      types: ['doc'],
      page: { limit: 200 },
    })).then((set) => {
      if (!active) return;
      const labels = new Map<string, string>();
      for (const object of set.objects) {
        if (!documentIds.has(object.id)) continue;
        const title = object.properties.title ?? object.properties.name ?? object.properties.path;
        labels.set(object.id, typeof title === 'string' && title.length > 0 ? title : object.id);
      }
      setDocLabels(labels);
    }).catch(() => {
      if (active) setDocLabels(new Map());
    });
    return () => {
      active = false;
    };
  }, [host, catalog]);

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
          try {
            const loaded = await fetchChatThread(threadId);
            if (!active) return;
            setLoadError(null);
            setThread(loaded);
            // Collapsed by default for discoverability via the layers edge control.
            setInspectorOpen(false);
            return;
          } catch (error) {
            // In-memory catalog is per-instance: a stale URL must not be reported
            // as harness/data-API failure. Drop into create-or-select below.
            const message = error instanceof Error ? error.message : '';
            if (!message.includes('thread_not_found') && !message.includes('404')) {
              throw error;
            }
          }
        }
        const existing = catalog.threads.find(
          (item) => item.projectId === catalog.activeProjectId,
        );
        if (existing) {
          router.replace(`/chat/${encodeURIComponent(existing.id)}`);
          return;
        }
        const created = await createChatThread({
          projectId: catalog.activeProjectId ?? undefined,
          title: 'New thread',
        });
        if (!active) return;
        setLoadError(null);
        setCatalog({ ...catalog, threads: [created, ...catalog.threads] });
        router.replace(`/chat/${encodeURIComponent(created.id)}`);
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
    || (loadError != null && connection !== 'unauthenticated' && connection !== 'identity-refused');

  const needsSignIn = connection === 'unauthenticated';

  const setInspectorOpenPersisted = useCallback(
    (open: boolean) => {
      setInspectorOpen(open);
      if (thread) {
        void persistChatThread(thread.id, { railCollapsed: !open }).catch(() => {});
      }
    },
    [thread],
  );

  const onOpenThread = useCallback(
    (id: string) => {
      router.push(`/chat/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const contextFolders = useMemo(() => {
    if (!thread || !catalog) return [];
    return foldersFromProject(thread, catalog, includeOverrides, docLabels);
  }, [thread, catalog, includeOverrides, docLabels]);

  const contextEntries = useMemo(
    () => contextFolders.flatMap((folder) => folder.entries),
    [contextFolders],
  );

  const artifactsByMessage = useMemo(
    () => (thread ? artifactsFromThread(thread) : {}),
    [thread],
  );

  const onToggleContextInclude = useCallback((entryId: string) => {
    setIncludeOverrides((current) => {
      const next = new Map(current);
      const existing = next.has(entryId) ? Boolean(next.get(entryId)) : true;
      next.set(entryId, !existing);
      return next;
    });
  }, []);

  if (!mounted || !host) {
    return <div className="h-dvh w-full bg-ij-frame" aria-busy="true" />;
  }

  const degradation = loadError
    ? degradationFor(
        loadError === 'workspace_object_scope_unenforced'
          ? 'workspace_object_scope_unenforced'
          : 'console_data_api_unreachable',
      )
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
              <div className="flex h-full min-h-0">
                {catalog ? (
                  <ChatSidebar
                    catalog={catalog}
                    activeThreadId={thread?.id ?? null}
                    capabilities={capabilities}
                    unreachable={unreachable}
                    onCatalogChange={setCatalog}
                    onOpenThread={onOpenThread}
                    contextFolders={contextFolders}
                    onToggleContextInclude={onToggleContextInclude}
                    surface="chat"
                  />
                ) : (
                  <aside
                    data-chat-sidebar
                    className="shrink-0 border-r border-[color:var(--paper-seam,var(--ij-seam))] bg-[color:var(--paper-sunken,var(--ij-frame))] p-3 text-ij-ink-info"
                    style={{ width: 'var(--ij-chat-sidebar-w)' }}
                  >
                    {needsSignIn
                      ? 'Sign in with GitHub to connect the harness.'
                      : degradation
                        ? degradation.cause
                        : 'Loading projects…'}
                  </aside>
                )}

                <main
                  data-island="editor"
                  data-block-size="w"
                  className={cn(
                    // Transparent island over MaterialLayer: same lift contract
                    // as console tool/editor shells (rounded free edge, frame rail).
                    // Flush to top/right; left seam is the icon-rail panel edge.
                    // When the inspector opens it takes flex width: no right gutter.
                    'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-ij-island bg-transparent',
                  )}
                >
                  {needsSignIn ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ij-ink-info" role="status">
                      <p>Sign in with GitHub to bind this console to the harness.</p>
                      <Link
                        href="/api/auth/signin"
                        className="rounded-[var(--radius-control)] border border-ij-control-border bg-ij-raised px-3 py-2 text-ij-ink hover:bg-ij-hover-surface"
                      >
                        Sign in with GitHub
                      </Link>
                    </div>
                  ) : null}
                  {!needsSignIn && degradation && !thread ? (
                    <div className="flex flex-1 items-center justify-center text-ij-ink-info" role="status">
                      {degradation.cause}
                    </div>
                  ) : null}
                  {!needsSignIn && thread ? (
                    <RuntimeTree
                      host={host}
                      thread={thread}
                      unreachable={unreachable}
                      attachments={attachments}
                      artifactsByMessage={artifactsByMessage}
                    />
                  ) : null}
                </main>

                {wide ? (
                  <InspectorRail
                    host={host}
                    open={inspectorOpen}
                    onOpenChange={setInspectorOpenPersisted}
                    sections={CHAT_INSPECTOR_SECTIONS}
                    workspaceName={
                      catalog?.projects.find((project) => project.id === catalog.activeProjectId)?.name
                      ?? 'CommonPlace'
                    }
                  />
                ) : (
                  <>
                    {inspectorOpen ? (
                      <button
                        type="button"
                        aria-label="Close inspector rail"
                        className="absolute inset-0 z-20 bg-ij-frame/50"
                        onClick={() => setInspectorOpenPersisted(false)}
                      />
                    ) : null}
                    <div className="absolute right-0 top-0 z-30 h-full">
                      <InspectorRail
                        host={host}
                        open={inspectorOpen}
                        onOpenChange={setInspectorOpenPersisted}
                        sections={CHAT_INSPECTOR_SECTIONS}
                        workspaceName={
                          catalog?.projects.find((project) => project.id === catalog.activeProjectId)?.name
                          ?? 'CommonPlace'
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </ChatDropProvider>
          </SessionProvider>
        </HostProvider>
      </div>
    </div>
  );
}
