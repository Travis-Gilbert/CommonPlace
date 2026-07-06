'use client';

/** Page-level wrapper: builds the concrete MemoryBlockHost + the Set's surface
 *  object tree, then renders through Codex's SurfaceRenderer. The Anytype Set is
 *  now a first-class citizen of the object model — not a bespoke page. */
import { useMemo } from 'react';
import SurfaceRenderer from '@/components/commonplace/surface/SurfaceRenderer';
import { MemoryBlockHost } from '@/lib/block-view/host/MemoryBlockHost';
import { buildSurfaceObjects } from './surface-objects';
import type { ObjectGraph } from './model';

export function DatabaseSurface({ graph }: { graph: ObjectGraph }) {
  const host = useMemo(() => new MemoryBlockHost(graph, buildSurfaceObjects(graph)), [graph]);
  return <SurfaceRenderer surfaceId={graph.space} host={host} chrome={false} />;
}
