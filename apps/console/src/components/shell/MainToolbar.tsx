'use client';

// SOURCING: hand-roll. The Int UI main toolbar with the RunWidget is a named
// chrome signature; no library models it. The project widget is the layout
// switcher (R3.3): it lists the seeded surface objects and switches screens
// by flipping the active flag through the host; the widget is chrome and
// renders in Int UI type. The toolbar center hosts the omnibar's collapsed
// field (R1); while a run streams, the field gives way to the quiet
// streaming chip carrying the mark at chip scale. The run widget binds to
// real run state and renders its empty state otherwise, never a fixture run.

import { useEffect, useRef, useState } from 'react';
import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { useShellStore } from '@/lib/shell-store';
import { useThreadStore } from '@/lib/thread-store';
import { OmnibarField } from './Omnibar';
import { IconChevronDown, IconRun, IconSearch, IconStop } from './icons';

interface MainToolbarProps {
  readonly host: BlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly activeSurfaceId: string;
}

function LayoutSwitcher({ host, surfaces, activeSurfaceId }: MainToolbarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = surfaces.find((surface) => surface.id === activeSurfaceId);
  const label = String(active?.properties.name ?? 'Workspace');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const switchTo = (surfaceId: string) => {
    for (const surface of surfaces) {
      void host.emit({
        kind: 'update',
        id: surface.id,
        patch: { active: surface.id === surfaceId },
      });
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-layout-switcher
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Layout: ${label}`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-ij-control items-center gap-1 rounded-ij-arc px-2 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        {label}
        <IconChevronDown size={12} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Layouts"
          className="absolute left-0 top-full z-50 mt-1 min-w-40 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1"
        >
          {surfaces.map((surface) => {
            const selected = surface.id === activeSurfaceId;
            return (
              <button
                key={surface.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-layout-option={surface.id}
                onClick={() => switchTo(surface.id)}
                className="flex h-ij-row w-full items-center rounded-ij-arc-underline px-2 text-left text-ij-ink aria-selected:bg-ij-selection"
                style={{ transition: 'var(--rec-clickable-transition)' }}
              >
                {String(surface.properties.name ?? surface.id)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function MainToolbar({ host, surfaces, activeSurfaceId }: MainToolbarProps) {
  const isRunning = useThreadStore((state) => state.isRunning);
  const cancel = useThreadStore((state) => state.cancel);
  const openOmnibar = useShellStore((state) => state.openOmnibar);

  return (
    <header className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam bg-ij-chrome px-2">
      <span className="px-2 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
        CommonPlace
      </span>
      <LayoutSwitcher host={host} surfaces={surfaces} activeSurfaceId={activeSurfaceId} />

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
            color: isRunning ? 'var(--ij-ink-bright)' : 'var(--ij-ink)',
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
