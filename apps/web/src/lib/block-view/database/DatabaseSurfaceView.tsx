'use client';

/** The registered `database` renderer — a Set view-instance rendered as the full
 *  Anytype-grade DatabaseView over the host's resolved graph. This is the seam:
 *  Codex's SurfaceRenderer resolves descriptor_id "database" → this component. */
import type { SurfaceViewRendererProps } from '@/components/commonplace/surface/types';
import type { DbHost } from '@/lib/block-view/host/MemoryBlockHost';
import { DatabaseView } from './DatabaseView';

export function DatabaseSurfaceView({ host }: SurfaceViewRendererProps) {
  const dbHost = host as DbHost;
  if (!dbHost.graph) return null;
  return <DatabaseView host={dbHost} />;
}
