'use client';

// SOURCING: hand-roll. Hosts BlockCanvas for ground regions and writes
// reorder, resize, and placement through BlockHost.emit (receipted moves).

import { useCallback, useMemo, useState } from 'react';
import type { BlockGeometry, BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { CONTAINS_EDGE } from '@commonplace/block-view/surface-tree';
import {
  BlockCanvas,
  type BlockCanvasItem,
  type BlockPlacementZone,
} from '@/components/blocks/BlockCanvas';
import { skeletonForKind } from '@/components/blocks/kind-glyph';
import { ViewInstanceHost } from '@/components/shell/ViewInstanceHost';
import { recordBlockMoveReceipts } from '@/lib/block-move-receipts';
import { geometryFromSize, packOrigin } from '@/lib/block-geometry';
import {
  hasPersistedGeometry,
  nestBlockInContainerActions,
  placeBlockAction,
  readBlockGeometry,
  readBlockSize,
  readConfigRecord,
  reorderBlockActions,
  setBlockGeometryAction,
  type KanbanColumnId,
} from '@/lib/block-placement';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';

export interface BlockArrangementHostProps {
  readonly region: ObjectRef;
  readonly instances: readonly ObjectRef[];
  readonly host: BlockHost;
  /** Companion / editor region ids available as promotion targets. */
  readonly dockRegionIds?: readonly string[];
  readonly railRegionId?: string | null;
  readonly fullRegionId?: string | null;
}

export function BlockArrangementHost({
  region,
  instances,
  host,
  dockRegionIds = [],
  railRegionId = null,
  fullRegionId = null,
}: BlockArrangementHostProps) {
  const [moveReceiptCount, setMoveReceiptCount] = useState(0);
  const orderedIds = useMemo(() => instances.map((instance) => instance.id), [instances]);

  const items = useMemo((): BlockCanvasItem[] => {
    let packIndex = 0;
    return instances.flatMap((instance) => {
      const descriptorId = String(instance.properties.descriptor_id ?? '');
      const descriptor = CONSOLE_VIEW_REGISTRY.viewById(descriptorId);
      if (!descriptor?.block?.placements.includes('ground')) return [];
      const fallback = descriptor.block?.defaultSize ?? 'm';
      const size = readBlockSize(instance, fallback);
      const geometry = hasPersistedGeometry(instance)
        ? readBlockGeometry(instance, fallback)
        : geometryFromSize(size, packOrigin(packIndex++, size));
      return [
        {
          descriptor,
          viewInstanceId: instance.id,
          size,
          geometry,
          shell: {
            title: String(instance.properties.title ?? descriptor.name),
            skeleton: skeletonForKind(descriptor.block.kindGlyph),
            children: <ViewInstanceHost instance={instance} host={host} bare />,
          },
        },
      ];
    });
  }, [host, instances]);

  const promotionZones = useMemo((): BlockPlacementZone[] => {
    const zones: BlockPlacementZone[] = [];
    if (railRegionId) {
      zones.push({
        id: `rail:${railRegionId}`,
        kind: 'rail',
        regionId: railRegionId,
        label: 'Move to rail',
      });
    }
    for (const regionId of dockRegionIds) {
      zones.push({
        id: `dock:${regionId}`,
        kind: 'dock',
        regionId,
        label: 'Dock as tool',
      });
    }
    if (fullRegionId) {
      zones.push({
        id: `full:${fullRegionId}`,
        kind: 'full',
        regionId: fullRegionId,
        label: 'Expand to full',
      });
    }
    return zones;
  }, [dockRegionIds, railRegionId, fullRegionId]);

  const onReorder = useCallback(
    (activeId: string, overId: string | null) => {
      const actions = reorderBlockActions(region.id, orderedIds, activeId, overId);
      for (const action of actions) void host.emit(action);
    },
    [host, orderedIds, region.id],
  );

  const onGeometryChange = useCallback(
    (viewInstanceId: string, geometry: BlockGeometry) => {
      const instance = instances.find((candidate) => candidate.id === viewInstanceId);
      void host.emit(
        setBlockGeometryAction(
          viewInstanceId,
          geometry,
          instance ? readConfigRecord(instance) : {},
        ),
      );
    },
    [host, instances],
  );

  const onNest = useCallback(
    (childId: string, containerId: string, columnId: string) => {
      void (async () => {
        const child = instances.find((instance) => instance.id === childId);
        const container = instances.find((instance) => instance.id === containerId);
        if (!container || childId === containerId) return;
        const column: KanbanColumnId =
          columnId === 'doing' || columnId === 'done' || columnId === 'todo'
            ? columnId
            : 'todo';
        const order = container.relations?.[CONTAINS_EDGE]?.length ?? 0;
        const actions = nestBlockInContainerActions(
          childId,
          containerId,
          column,
          order,
          child ? readConfigRecord(child) : {},
        );
        let moves = 0;
        for (const action of actions) {
          const result = await host.emit(action);
          if (
            result.ok &&
            result.value?.action_kind === 'move' &&
            result.value.status === 'applied'
          ) {
            moves += 1;
          }
        }
        if (moves > 0) {
          recordBlockMoveReceipts(moves);
          setMoveReceiptCount((count) => count + moves);
        }
      })();
    },
    [host, instances],
  );

  const onPromote = useCallback(
    (viewInstanceId: string, zone: BlockPlacementZone) => {
      void (async () => {
        const instance = instances.find((candidate) => candidate.id === viewInstanceId);
        const order = 0;
        const actions = placeBlockAction(
          viewInstanceId,
          {
            placement: zone.kind,
            regionId: zone.regionId,
            order,
            ...(zone.kind === 'full' ? { size: 'full' as const } : {}),
          },
          instance ? readConfigRecord(instance) : {},
        );
        let moves = 0;
        for (const action of actions) {
          const result = await host.emit(action);
          if (
            result.ok &&
            result.value?.action_kind === 'move' &&
            result.value.status === 'applied'
          ) {
            moves += 1;
          }
        }
        if (zone.kind === 'rail') {
          await host.emit({
            kind: 'update',
            id: zone.regionId,
            patch: { open: true },
          });
        }
        if (zone.kind === 'full') {
          await host.emit({
            kind: 'update',
            id: zone.regionId,
            patch: { active_tab: viewInstanceId },
          });
        }
        if (moves > 0) {
          recordBlockMoveReceipts(moves);
          setMoveReceiptCount((count) => count + moves);
        }
      })();
    },
    [host, instances],
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ij-ink-info">
        No ground block instances in this canvas.
      </div>
    );
  }

  return (
    <div
      data-block-arrangement
      data-block-move-receipt-count={moveReceiptCount}
      className="flex h-full min-h-0 flex-col overflow-auto p-ij-island-gutter"
    >
      <BlockCanvas
        items={items}
        promotionZones={promotionZones}
        onReorder={onReorder}
        onGeometryChange={onGeometryChange}
        onPromote={onPromote}
        onNest={onNest}
      />
    </div>
  );
}
