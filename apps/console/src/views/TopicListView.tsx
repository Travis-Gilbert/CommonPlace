'use client';

// SOURCING: @commonplace/block-view. A standing topic opens by retargeting
// the Indexer view instance and activating its seeded surface. Navigation is
// therefore an arrangement edit through the host, not a page-local router.

import { useState } from 'react';
import type { JsonValue, ObjectRef, ViewRenderProps } from '@commonplace/block-view/types';
import { surfaceQuery } from '@commonplace/block-view/surface-tree';
import { SURVEY_SURFACE_ID, SURVEY_VIEW_INSTANCE_ID } from '@/lib/workspace-seed';
import { ViewState } from './ViewStates';

async function openTopic(topic: ObjectRef, host: ViewRenderProps['host']): Promise<string | null> {
  const layout = await Promise.resolve(host.query(surfaceQuery()));
  const surfaces = layout.objects.filter((object) => object.type === 'surface');
  const retargeted = await host.emit({
    kind: 'update',
    id: SURVEY_VIEW_INSTANCE_ID,
    patch: {
      title: `Indexer: ${String(topic.properties.title ?? topic.id)}`,
      query: {
        types: ['topic', 'capture', 'survey-edge'],
        where: { kind: 'eq', field: 'topic_id', value: topic.id },
        live: true,
      } as unknown as JsonValue,
    },
  });
  if (!retargeted.ok) {
    return retargeted.error ?? 'Could not retarget the Indexer view to this topic.';
  }
  await host.emit({
    kind: 'update',
    id: SURVEY_SURFACE_ID,
    patch: { active: true, name: 'Indexer' },
  });
  for (const surface of surfaces.filter((surface) => surface.id !== SURVEY_SURFACE_ID)) {
    await host.emit({
      kind: 'update',
      id: surface.id,
      patch: { active: false },
    });
  }
  return null;
}

export function TopicListView({ set, host }: ViewRenderProps) {
  const [error, setError] = useState<string | null>(null);
  const topics = [...set.objects]
    .filter((object) => object.type === 'topic')
    .sort((left, right) => String(left.properties.title).localeCompare(String(right.properties.title)));

  if (topics.length === 0) return <ViewState state="empty" />;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-ij-gold" style={{ fontWeight: 'var(--rec-weight-cap)' }}>Standing topics</p>
        <h1 className="mt-2 text-2xl text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
          Open a topic in Indexer
        </h1>
        <p className="mt-2 max-w-prose text-ij-ink-info">
          Each topic opens its accumulated captures, learned highlights, and evidenced connections as a research board.
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-ij-arc border border-ij-seam bg-ij-chrome p-3 text-sm text-ij-ink">
            {error}
          </p>
        ) : null}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Standing topics">
          {topics.map((topic) => (
            <li key={topic.id}>
              <button
                type="button"
                onClick={() => {
                  void openTopic(topic, host).then((nextError) => setError(nextError));
                }}
                className="survey-focusable flex min-h-32 w-full flex-col border border-ij-seam-raised bg-ij-chrome p-4 text-left hover:bg-ij-raised"
                style={{
                  transition: 'var(--rec-clickable-transition)',
                  borderRadius: 'var(--ij-island-radius)',
                }}
                data-island
              >
                <span className="text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
                  {String(topic.properties.title ?? topic.id)}
                </span>
                <span className="mt-2 text-ij-ink-info">
                  {String(topic.properties.description ?? '')}
                </span>
                <span className="mt-auto pt-4 font-ij-mono text-xs text-ij-gold">
                  {String(topic.properties.capture_count ?? 0)} captures · {String(topic.properties.status ?? 'standing')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
