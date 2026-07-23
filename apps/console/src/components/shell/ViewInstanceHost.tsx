'use client';

// SOURCING: @commonplace/block-view (descriptor resolution over ObjectQuery).
// The marriage requirement (G3): every pane is a view instance resolved by
// descriptor against the host. Ground blocks render inside BlockShell;
// full-only placements stay bare. Query-less containers (kanban) still render.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlockHost, ObjectQuery, ObjectRef, ObjectSet } from '@commonplace/block-view/types';
import { BlockShell } from '@/components/blocks/BlockShell';
import { skeletonForKind } from '@/components/blocks/kind-glyph';
import { recordBlockMoveReceipts } from '@/lib/block-move-receipts';
import { placeBlockAction } from '@/lib/block-placement';
import { CONSOLE_VIEW_REGISTRY, FallbackCard } from '@/views/registry';
import { ViewState, type ViewStateKind } from '@/views/ViewStates';

function instanceQuery(instance: ObjectRef): ObjectQuery | null {
  const raw = instance.properties.query;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const types = (raw as { types?: unknown }).types;
  if (!Array.isArray(types)) return null;
  return raw as unknown as ObjectQuery;
}

function emptyObjectSet(): ObjectSet {
  return {
    objects: [],
    shape: {
      types: [],
      fields: [],
      relations: [],
      axes: {},
      cardinality: 'empty',
    },
    subscribe: () => () => {},
  };
}

export function ViewInstanceHost({
  instance,
  host,
  onHide,
  forceShell,
  bare,
  returnToGridRegionId,
}: {
  instance: ObjectRef;
  host: BlockHost;
  onHide?: () => void;
  /** Force BlockShell even when the descriptor omits ground placement (tool windows). */
  forceShell?: boolean;
  /** Render descriptor body only (BlockArrangementHost already wraps BlockShell). */
  bare?: boolean;
  /** When set, expose Return to ground (rail tray to ground move). */
  returnToGridRegionId?: string;
}) {
  const descriptorId = String(instance.properties.descriptor_id ?? '');
  const descriptor = CONSOLE_VIEW_REGISTRY.viewById(descriptorId);
  const query = instanceQuery(instance);
  const [set, setSet] = useState<ObjectSet | null>(() => (query ? null : emptyObjectSet()));
  const [failed, setFailed] = useState(false);
  const [stateKind, setStateKind] = useState<ViewStateKind>(query ? 'loading' : 'populated');
  const [reloadToken, setReloadToken] = useState(0);
  const [prevQueryKey, setPrevQueryKey] = useState<string | null>(() =>
    query ? JSON.stringify(query) : null,
  );
  const queryKey = query ? JSON.stringify(query) : null;
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    if (!query) {
      setFailed(false);
      setSet(emptyObjectSet());
      setStateKind('populated');
    } else {
      setFailed(false);
      setSet(null);
      setStateKind('loading');
    }
  }

  const retry = useCallback(() => {
    setFailed(false);
    setSet(query ? null : emptyObjectSet());
    setStateKind(query ? 'loading' : 'populated');
    setReloadToken((token) => token + 1);
  }, [query]);

  useEffect(() => {
    if (!query) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    // Companion marker queries (thread/files/context/surface-tool) are not
    // record sets: the descriptor owns the pane even when the set is empty.
    const markerQuery = query.types.some((type) =>
      type === 'thread'
      || type === 'files-view'
      || type === 'context-view'
      || type === 'surface-tool',
    );
    Promise.resolve(host.query(query))
      .then((next) => {
        if (!active) return;
        setSet(next);
        setStateKind(next.objects.length === 0 && !markerQuery ? 'empty' : 'populated');
        if (typeof next.subscribe === 'function') {
          unsubscribe = next.subscribe((following) => {
            if (!active) return;
            setSet(following);
            setStateKind(following.objects.length === 0 && !markerQuery ? 'empty' : 'populated');
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
    // queryKey covers arrangement edits that retarget the pane (doc navigation
    // patches query in place). Do not depend on `instance` identity: every
    // layout notify allocates new ObjectRefs and would cancel in-flight
    // queryLiveDomain fetches, leaving the previous document painted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, reloadToken, queryKey]);

  const empty = useMemo(() => emptyObjectSet(), []);

  if (!descriptor) return <FallbackCard descriptorId={descriptorId || instance.id} />;

  const mountsGround = descriptor.block?.placements.includes('ground') ?? false;
  const useShell = !bare && (forceShell || mountsGround);
  const Render = descriptor.render;
  const renderSet = set ?? empty;

  if (!useShell) {
    if (failed) return <ViewState state="error" errorMessage="View query failed." onRetry={retry} />;
    if (query && !set) return <ViewState state="loading" />;
    return <Render set={renderSet} host={host} instance={instance} />;
  }

  const shellState: ViewStateKind = failed
    ? 'error'
    : query && !set
      ? 'loading'
      : stateKind;

  const body =
    shellState === 'populated' || shellState === 'stale' || (!query && shellState !== 'error') ? (
      <Render set={renderSet} host={host} instance={instance} />
    ) : null;

  const returnToGrid = returnToGridRegionId ? (
    <button
      type="button"
      data-block-return-to-ground
      aria-label="Return to ground"
      title="Return to ground"
      onClick={() => {
        void (async () => {
          const [action] = placeBlockAction(instance.id, {
            placement: 'ground',
            regionId: returnToGridRegionId,
            order: 0,
          });
          if (!action) return;
          const result = await host.emit(action);
          if (
            result.ok &&
            result.value?.action_kind === 'move' &&
            result.value.status === 'applied'
          ) {
            recordBlockMoveReceipts(1);
          }
        })();
      }}
      className="rounded-ij-arc-underline px-1.5 font-ij-ui text-ij-island-meta text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
    >
      Return to ground
    </button>
  ) : null;

  return (
    <BlockShell
      descriptor={descriptor}
      viewInstanceId={instance.id}
      state={shellState}
      errorMessage={failed ? 'View query failed.' : undefined}
      onRetry={failed ? retry : undefined}
      count={set?.objects.length}
      live={Boolean(query?.live)}
      onHide={onHide}
      skeleton={skeletonForKind(descriptor.block?.kindGlyph)}
      draggable={false}
      actions={returnToGrid}
    >
      {body}
    </BlockShell>
  );
}
