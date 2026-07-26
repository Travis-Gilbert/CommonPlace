'use client';

// SOURCING: hand-roll. Layout switcher relocated from the frame toolbar into
// the sidebar header (SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS12). Same control,
// same Work / Objects / Tools / System grouping, same oracle hooks.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ObjectRef } from '@commonplace/block-view/types';
import type { ConsoleBlockHost } from '@/lib/console-host';
import { IconChevronDown } from './icons';

type SurfaceGroupId = 'work' | 'objects' | 'tools' | 'system';

const GROUP_LABEL: Record<SurfaceGroupId, string> = {
  work: 'Work',
  objects: 'Objects',
  tools: 'Tools',
  system: 'System',
};

export function groupFor(surface: ObjectRef): SurfaceGroupId {
  const role = String(surface.properties.role ?? '');
  const kind = String(surface.properties.kind ?? '');
  if (role === 'place') return 'work';
  if (role === 'collection') return 'objects';
  if (
    kind === 'settings' ||
    kind === 'account' ||
    kind === 'harness-status' ||
    kind === 'proactivity' ||
    kind === 'appearance'
  ) {
    return 'system';
  }
  return 'tools';
}

export function LayoutSwitcher({
  host,
  surfaces,
  activeSurfaceId,
  showActiveName = false,
}: {
  readonly host: ConsoleBlockHost;
  readonly surfaces: readonly ObjectRef[];
  readonly activeSurfaceId: string;
  /** CS12: active surface name must appear once per window. Default off. */
  readonly showActiveName?: boolean;
}) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutTriggerRef = useRef<HTMLButtonElement | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);
  const activeName = String(
    surfaces.find((surface) => surface.id === activeSurfaceId)?.properties.name ?? 'Chat',
  );
  const groups = useMemo(() => {
    const buckets: Record<SurfaceGroupId, ObjectRef[]> = {
      work: [],
      objects: [],
      tools: [],
      system: [],
    };
    for (const surface of surfaces) {
      buckets[groupFor(surface)].push(surface);
    }
    return (['work', 'objects', 'tools', 'system'] as const)
      .map((id) => ({ id, label: GROUP_LABEL[id], items: buckets[id] }))
      .filter((group) => group.items.length > 0);
  }, [surfaces]);

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
    <div className="relative w-full">
      <button
        ref={layoutTriggerRef}
        type="button"
        data-layout-switcher
        aria-haspopup="menu"
        aria-expanded={layoutOpen}
        aria-label={showActiveName ? undefined : `Layouts. ${activeName} active.`}
        onClick={() => setLayoutOpen((value) => !value)}
        className="flex h-ij-control w-full items-center gap-1 rounded-ij-arc px-2 text-ij-ink hover:bg-ij-hover-surface"
        style={{
          transition: 'var(--rec-clickable-transition)',
          fontFamily: 'var(--cp-font-human)',
          fontWeight: 600,
        }}
      >
        {showActiveName ? <span data-active-surface-name>{activeName}</span> : <span>Layouts</span>}
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
          className="absolute left-0 top-full z-40 mt-1 min-w-52 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1"
        >
          {groups.map((group, groupIndex) => (
            <div
              key={group.id}
              role="group"
              aria-label={group.label}
              data-layout-group={group.id}
              className={groupIndex > 0 ? 'mt-1 border-t border-ij-seam pt-1' : undefined}
            >
              <div className="px-2 py-1 text-ij-island-meta text-ij-ink-info">
                {group.label}
              </div>
              {group.items.map((surface) => (
                <button
                  key={surface.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={surface.id === activeSurfaceId}
                  data-layout-option={surface.id}
                  data-layout-group={group.id}
                  onClick={() => switchTo(surface.id)}
                  className="flex h-ij-row w-full items-center rounded-ij-arc-underline px-2 text-left text-ij-ink hover:bg-ij-hover-surface"
                  style={{ transition: 'var(--rec-clickable-transition)' }}
                >
                  {String(surface.properties.name ?? surface.id)}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
