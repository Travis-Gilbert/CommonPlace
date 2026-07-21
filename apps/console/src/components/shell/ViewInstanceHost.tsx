'use client';

// SOURCING: @commonplace/block-view (descriptor resolution over ObjectQuery).
// The marriage requirement (G3): every pane is a view instance resolved by
// descriptor against the host. Island-mounted descriptors render inside
// IslandShell (HANDOFF-CONSOLE-ISLAND-SHELL); surface-only mounts stay bare.

import { useCallback, useEffect, useState } from 'react';
import type { BlockHost, ObjectQuery, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import { IslandShell } from '@/components/blocks/IslandShell';
import { skeletonForKind } from '@/components/blocks/kind-glyph';
import { CONSOLE_VIEW_REGISTRY, FallbackCard } from '@/views/registry';
import { ViewState, type ViewStateKind } from '@/views/ViewStates';

function instanceQuery(instance: ObjectRef): ObjectQuery | null {
  const raw = instance.properties.query;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const types = (raw as { types?: unknown }).types;
  if (!Array.isArray(types)) return null;
  return raw as unknown as ObjectQuery;
}

export function ViewInstanceHost({
  instance,
  host,
  onHide,
  forceShell,
  bare,
}: {
  instance: ObjectRef;
  host: BlockHost;
  onHide?: () => void;
  /** Force IslandShell even when the descriptor omits island mount (tool windows). */
  forceShell?: boolean;
  /** Render descriptor body only (IslandArrangementHost already wraps IslandShell). */
  bare?: boolean;
}) {
  const descriptorId = String(instance.properties.descriptor_id ?? '');
  const descriptor = CONSOLE_VIEW_REGISTRY.viewById(descriptorId);
  const query = instanceQuery(instance);
  const [set, setSet] = useState<ObjectSet | null>(null);
  const [failed, setFailed] = useState(false);
  const [stateKind, setStateKind] = useState<ViewStateKind>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => {
    setFailed(false);
    setSet(null);
    setStateKind('loading');
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    if (!query) return;
    setFailed(false);
    setStateKind('loading');
    Promise.resolve(host.query(query))
      .then((next) => {
        if (!active) return;
        setSet(next);
        setStateKind(next.objects.length === 0 ? 'empty' : 'populated');
        if (typeof next.subscribe === 'function') {
          unsubscribe = next.subscribe((following) => {
            if (!active) return;
            setSet(following);
            setStateKind(following.objects.length === 0 ? 'empty' : 'populated');
          });
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setStateKind('error');
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
    // reloadToken forces a requery after Retry; instance identity covers arrangement edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, instance, reloadToken]);

  if (!descriptor) return <FallbackCard descriptorId={descriptorId || instance.id} />;

  const mountsIsland = descriptor.block?.mounts.includes('island') ?? false;
  const useShell = !bare && (forceShell || mountsIsland);
  const Render = descriptor.render;

  if (!useShell) {
    if (failed) return <ViewState state="error" errorMessage="View query failed." onRetry={retry} />;
    if (!query || !set) return <ViewState state="loading" />;
    return <Render set={set} host={host} />;
  }

  const shellState: ViewStateKind = failed
    ? 'error'
    : !query || !set
      ? 'loading'
      : stateKind;

  const body =
    (shellState === 'populated' || shellState === 'stale') && set ? (
      <Render set={set} host={host} />
    ) : null;

  return (
    <IslandShell
      descriptor={descriptor}
      viewInstanceId={instance.id}
      state={shellState}
      errorMessage={failed ? 'View query failed.' : undefined}
      onRetry={failed ? retry : undefined}
      count={set?.objects.length}
      live={Boolean(query?.live)}
      onHide={onHide}
      skeleton={skeletonForKind(descriptor.block?.kindGlyph)}
      draggable={mountsIsland}
    >
      {body}
    </IslandShell>
  );
}
