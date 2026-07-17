'use client';

// SOURCING: hand-roll. The Int UI main toolbar with the RunWidget is a named
// chrome signature; no library models it. Screen navigation lives in the
// leftmost stripe (the stripe surfaces group), not a toolbar dropdown; the
// toolbar shows the product name and the active screen as a quiet breadcrumb.
// The toolbar center hosts the omnibar's collapsed field (R1); while a run
// streams, the field gives way to the quiet streaming chip carrying the mark
// at chip scale. The run widget binds to real run state and renders its empty
// state otherwise, never a fixture run.

import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import { OmnibarField } from './Omnibar';
import { IconRun, IconSearch, IconStop } from './icons';

interface MainToolbarProps {
  readonly host: BlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly activeSurfaceId: string;
}

export function MainToolbar({ surfaces, activeSurfaceId }: MainToolbarProps) {
  const isRunning = useThreadStore((state) => state.isRunning);
  const cancel = useThreadStore((state) => state.cancel);
  const openOmnibar = useShellStore((state) => state.openOmnibar);
  const activeName = String(
    surfaces.find((surface) => surface.id === activeSurfaceId)?.properties.name ?? 'Workspace',
  );

  return (
    <header className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2">
      <span className="px-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        CommonPlace
      </span>
      <span aria-hidden className="text-ij-ink-disabled">
        /
      </span>
      <span data-active-surface-name className="text-ij-ink-info">
        {activeName}
      </span>

      <div className="mx-2 min-w-0 flex-1">
        <div className="mx-auto max-w-144">
          <OmnibarField />
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
        <button
          type="button"
          aria-label="Search everywhere (double Shift)"
          onClick={() => openOmnibar('search')}
          className="flex h-ij-control w-ij-control items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          style={{ width: 'var(--ij-control-h)', transition: 'var(--rec-clickable-transition)' }}
        >
          <IconSearch size={15} />
        </button>
      </div>
    </header>
  );
}
