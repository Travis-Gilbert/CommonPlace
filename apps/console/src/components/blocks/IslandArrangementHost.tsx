'use client';

// SOURCING: hand-roll. B10 host: mounts IslandGrid for kind=grid regions and
// writes reorder / resize / promotion through BlockHost.emit (receipted moves).

import { useCallback, useMemo } from 'react';
import type { BlockHost, BlockSize, ObjectRef } from '@commonplace/block-view/types';
import {
  IslandGrid,
  type IslandGridItem,
  type IslandPromotionZone,
} from '@/components/blocks/IslandGrid';
import { skeletonForKind } from '@/components/blocks/kind-glyph';
import { ViewInstanceHost } from '@/components/shell/ViewInstanceHost';
import {
  promoteIslandAction,
  readIslandSize,
  reorderIslandActions,
  resizeIslandAction,
} from '@/lib/island-promotion';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';

export interface IslandArrangementHostProps {
  readonly region: ObjectRef;
  readonly instances: readonly ObjectRef[];
  readonly host: BlockHost;
  /** Companion / editor region ids available as promotion targets. */
  readonly chromeRegionIds?: readonly string[];
  readonly stripeRegionId?: string | null;
  readonly surfaceEditorRegionId?: string | null;
}

export function IslandArrangementHost({
  region,
  instances,
  host,
  chromeRegionIds = [],
  stripeRegionId = null,
  surfaceEditorRegionId = null,
}: IslandArrangementHostProps) {
  const orderedIds = useMemo(() => instances.map((instance) => instance.id), [instances]);

  const items = useMemo((): IslandGridItem[] => {
    return instances.flatMap((instance) => {
      const descriptorId = String(instance.properties.descriptor_id ?? '');
      const descriptor = CONSOLE_VIEW_REGISTRY.viewById(descriptorId);
      if (!descriptor?.block?.mounts.includes('island')) return [];
      const size = readIslandSize(
        instance,
        (descriptor.block.sizes?.[0] as BlockSize | undefined) ?? 'm',
      );
      return [
        {
          descriptor,
          viewInstanceId: instance.id,
          size,
          shell: {
            title: String(instance.properties.title ?? descriptor.name),
            skeleton: skeletonForKind(descriptor.block.kindGlyph),
            children: <ViewInstanceHost instance={instance} host={host} bare />,
          },
        },
      ];
    });
  }, [host, instances]);

  const promotionZones = useMemo((): IslandPromotionZone[] => {
    const zones: IslandPromotionZone[] = [];
    if (stripeRegionId) {
      zones.push({
        id: `stripe:${stripeRegionId}`,
        kind: 'stripe',
        regionId: stripeRegionId,
        label: 'Promote to stripe',
      });
    }
    for (const regionId of chromeRegionIds) {
      zones.push({
        id: `chrome:${regionId}`,
        kind: 'chrome',
        regionId,
        label: 'Dock as tool',
      });
    }
    if (surfaceEditorRegionId) {
      zones.push({
        id: `surface:${surfaceEditorRegionId}`,
        kind: 'surface',
        regionId: surfaceEditorRegionId,
        label: 'Expand to surface',
      });
    }
    return zones;
  }, [chromeRegionIds, stripeRegionId, surfaceEditorRegionId]);

  const onReorder = useCallback(
    (activeId: string, overId: string | null) => {
      const actions = reorderIslandActions(region.id, orderedIds, activeId, overId);
      for (const action of actions) void host.emit(action);
    },
    [host, orderedIds, region.id],
  );

  const onSizeChange = useCallback(
    (viewInstanceId: string, size: BlockSize) => {
      void host.emit(resizeIslandAction(viewInstanceId, size));
    },
    [host],
  );

  const onPromote = useCallback(
    (viewInstanceId: string, zone: IslandPromotionZone) => {
      const order = 0;
      const actions = promoteIslandAction(viewInstanceId, {
        kind: zone.kind,
        regionId: zone.regionId,
        order,
        ...(zone.kind === 'surface' ? { size: 'full' as const } : {}),
      });
      for (const action of actions) void host.emit(action);
      if (zone.kind === 'surface') {
        void host.emit({
          kind: 'update',
          id: zone.regionId,
          patch: { active_tab: viewInstanceId },
        });
      }
    },
    [host],
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-ij-ink-info">
        No island-mount view instances in this grid.
      </div>
    );
  }

  return (
    <div data-island-arrangement className="flex h-full min-h-0 flex-col overflow-auto p-ij-island-gutter">
      <IslandGrid
        items={items}
        promotionZones={promotionZones}
        onReorder={onReorder}
        onSizeChange={onSizeChange}
        onPromote={onPromote}
      />
    </div>
  );
}
