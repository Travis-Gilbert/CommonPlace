'use client';

// SOURCING: @assistant-ui/react thread semantics with the existing register
// row treatment. The collection lists thread objects and opens the full chat
// surface only after a person selects one.

import { useRouter } from 'next/navigation';
import type { ObjectRef, ViewRenderProps } from '@commonplace/block-view/types';

function threadTitle(thread: ObjectRef): string {
  return String(thread.properties.title ?? thread.properties.name ?? thread.id);
}

function threadUpdatedAt(thread: ObjectRef): string | null {
  const raw = thread.properties.updated_at ?? thread.properties.updatedAt;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function ThreadListView({ host, set }: ViewRenderProps) {
  const router = useRouter();
  const threads = set.objects.filter((object) => object.type === 'thread');

  const openThread = async (thread: ObjectRef) => {
    await host.emit({ kind: 'open', id: thread.id, view: 'chat.surface' });
    router.push(`/chat/${encodeURIComponent(thread.id)}`);
  };

  if (threads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-ij-ink-info">
        No threads yet.
      </div>
    );
  }

  return (
    <section className="h-full overflow-y-auto bg-ij-editor p-2" aria-label="Threads">
      <ul className="flex flex-col gap-1">
        {threads.map((thread) => {
          const updatedAt = threadUpdatedAt(thread);
          return (
            <li key={thread.id}>
              <button
                type="button"
                className="flex min-h-ij-row w-full items-center gap-3 rounded-ij-arc-underline px-2 text-left hover:bg-ij-hover-surface"
                onClick={() => void openThread(thread)}
              >
                <span className="min-w-0 flex-1 truncate text-ij-ink">
                  {threadTitle(thread)}
                </span>
                {updatedAt ? (
                  <span className="shrink-0 text-ij-ink-info">{updatedAt}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
