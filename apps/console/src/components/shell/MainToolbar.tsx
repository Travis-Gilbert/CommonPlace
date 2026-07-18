'use client';

// SOURCING: hand-roll. The Int UI main toolbar with the RunWidget is a named
// chrome signature; no library models it. Screen navigation lives in the
// leftmost stripe (the stripe surfaces group), not a toolbar dropdown; the
// toolbar shows the product name and the active screen as a quiet breadcrumb.
// The toolbar center hosts the durable Search field. The run widget binds to
// real run state and renders its empty state otherwise, never a fixture run.

import { useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useThreadStore } from '@/lib/thread-store';
import { SearchField } from './SearchField';
import { IconChevronDown, IconRun, IconStop } from './icons';

interface MainToolbarProps {
  readonly host: BlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly activeSurfaceId: string;
}

export function MainToolbar({ host, surfaces, activeSurfaceId }: MainToolbarProps) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const isRunning = useThreadStore((state) => state.isRunning);
  const cancel = useThreadStore((state) => state.cancel);
  const activeName = String(
    surfaces.find((surface) => surface.id === activeSurfaceId)?.properties.name ?? 'Chat',
  );
  const switchTo = (surfaceId: string) => {
    for (const surface of surfaces) {
      void host.emit({ kind: 'update', id: surface.id, patch: { active: surface.id === surfaceId } });
    }
    setLayoutOpen(false);
  };

  return (
    <header className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2">
      <span className="px-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        CommonPlace
      </span>
      <div className="relative">
        <button
          type="button"
          data-layout-switcher
          aria-haspopup="menu"
          aria-expanded={layoutOpen}
          onClick={() => setLayoutOpen((value) => !value)}
          className="flex h-ij-control items-center gap-1 rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          style={{ transition: 'var(--rec-clickable-transition)' }}
        >
          <span data-active-surface-name>{activeName}</span>
          <IconChevronDown size={13} />
        </button>
        {layoutOpen ? (
          <div
            role="menu"
            aria-label="Layouts"
            className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1"
          >
            {surfaces.map((surface) => (
              <button
                key={surface.id}
                type="button"
                role="menuitemradio"
                aria-checked={surface.id === activeSurfaceId}
                data-layout-option={surface.id}
                onClick={() => switchTo(surface.id)}
                className="flex h-ij-row w-full items-center rounded-ij-arc-underline px-2 text-left text-ij-ink hover:bg-ij-hover-surface"
                style={{ transition: 'var(--rec-clickable-transition)' }}
              >
                {String(surface.properties.name ?? surface.id)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-2 min-w-0 flex-1">
        <div className="mx-auto max-w-144">
          <SearchField />
        </div>
      </div>

      <div className="flex shrink-0 items-center" style={{ gap: 'var(--rec-sibling-gap)' }}>
        <button
          type="button"
          data-run-widget
          data-running={isRunning ? 'true' : 'false'}
          aria-label={isRunning ? 'Stop the live run' : 'Run'}
          onClick={() => (isRunning ? cancel() : undefined)}
          disabled={!isRunning}
          className="flex h-ij-control items-center gap-1 rounded-ij-arc px-3 disabled:opacity-75"
          style={{
            background: isRunning ? 'var(--ij-running)' : 'var(--ij-raised)',
            color: isRunning ? 'var(--ij-ink-bright)' : 'var(--ij-ink-info)',
            transition: 'var(--rec-clickable-transition)',
          }}
        >
          {isRunning ? <IconStop size={14} /> : <IconRun size={14} />}
          {isRunning ? 'Running' : 'Run'}
        </button>
      </div>
    </header>
  );
}
