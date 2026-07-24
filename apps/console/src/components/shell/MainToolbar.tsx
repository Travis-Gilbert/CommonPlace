'use client';

// SOURCING: hand-roll. The Int UI main toolbar is a named chrome signature; no
// library models it. Screen navigation lives in the leftmost stripe (the stripe
// surfaces group), not a toolbar dropdown; the toolbar shows the active screen
// as a quiet breadcrumb. Search is not a durable chrome field: Shift Shift /
// Ctrl or Cmd K open the Search panel.

import { useEffect, useRef, useState } from 'react';
import type { ObjectRef } from '@commonplace/block-view/types';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { ACCOUNT_SURFACE_ID } from '@/lib/workspace-seed';
import { IconAccount, IconChevronDown } from './icons';

interface MainToolbarProps {
  readonly host: ConsoleBlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly activeSurfaceId: string;
}

export function MainToolbar({ host, surfaces, activeSurfaceId }: MainToolbarProps) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);
  const activeName = String(
    surfaces.find((surface) => surface.id === activeSurfaceId)?.properties.name ?? 'Chat',
  );
  const switchTo = (surfaceId: string) => {
    void host.activateSurface(surfaceId);
    setLayoutOpen(false);
  };

  useEffect(() => {
    if (!layoutOpen) return;
    requestAnimationFrame(() => {
      const selected = layoutMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      const first = layoutMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]');
      (selected ?? first)?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (layoutMenuRef.current?.contains(target) || layoutTriggerRef.current?.contains(target)) return;
      setLayoutOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setLayoutOpen(false);
      layoutTriggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [layoutOpen]);

  return (
    <header
      data-paint-region="toolbar"
      data-frame-resident="toolbar"
      className="flex h-ij-toolbar shrink-0 items-center justify-between gap-2 bg-transparent px-ij-island-gutter"
    >
      <div className="relative">
        <button
          ref={layoutTriggerRef}
          type="button"
          data-layout-switcher
          aria-haspopup="menu"
          aria-expanded={layoutOpen}
          onClick={() => setLayoutOpen((value) => !value)}
          className="flex h-ij-control items-center gap-1 rounded-ij-arc px-2 text-ij-ink hover:bg-ij-hover-surface"
          style={{
            transition: 'var(--rec-clickable-transition)',
            fontFamily: 'var(--cp-font-human)',
            fontWeight: 600,
          }}
        >
          <span data-active-surface-name>{activeName}</span>
          <IconChevronDown size={13} />
        </button>
        {layoutOpen ? (
          <div
            ref={layoutMenuRef}
            role="menu"
            aria-label="Layouts"
            onKeyDown={(event) => {
              const items = [...(layoutMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              let next = current;
              if (event.key === 'ArrowDown') next = (current + 1) % items.length;
              else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = items.length - 1;
              else return;
              event.preventDefault();
              items[next]?.focus();
            }}
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

      <div className="flex shrink-0 items-center" style={{ gap: 'var(--rec-sibling-gap)' }}>
        <button
          type="button"
          data-account-trigger
          aria-label="Account"
          aria-pressed={activeSurfaceId === ACCOUNT_SURFACE_ID}
          onClick={() => void host.activateSurface(ACCOUNT_SURFACE_ID)}
          className="flex h-ij-control w-ij-control items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
          style={{ transition: 'var(--rec-clickable-transition)' }}
        >
          <IconAccount size={15} />
        </button>
      </div>
    </header>
  );
}
