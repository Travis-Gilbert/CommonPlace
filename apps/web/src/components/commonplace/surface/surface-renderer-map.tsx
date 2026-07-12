'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { SurfaceViewRendererProps } from './types';

const TableSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.TableSurfaceView),
  { ssr: false },
);
const BoardSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.BoardSurfaceView),
  { ssr: false },
);
const CardSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.CardSurfaceView),
  { ssr: false },
);
const ListSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.ListSurfaceView),
  { ssr: false },
);
const TimelineSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.TimelineSurfaceView),
  { ssr: false },
);
const GraphSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.GraphSurfaceView),
  { ssr: false },
);
const ChipSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('./SurfaceViewRenderers').then((module) => module.ChipSurfaceView),
  { ssr: false },
);
<<<<<<< HEAD
=======
// The rich Anytype-grade Set view, registered as the `database` renderer.
const DatabaseSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('@/lib/block-view/database/DatabaseSurfaceView').then((module) => module.DatabaseSurfaceView),
  { ssr: false },
);
>>>>>>> origin/main
// The Operator surface (OC5): each view-instance wraps a live operator component.
const OperatorAttentionView = dynamic<SurfaceViewRendererProps>(
  () => import('@/app/v2/operator/surface/renderers').then((module) => module.OperatorAttentionView),
  { ssr: false },
);
const OperatorBaysView = dynamic<SurfaceViewRendererProps>(
  () => import('@/app/v2/operator/surface/renderers').then((module) => module.OperatorBaysView),
  { ssr: false },
);
const OperatorBayTableView = dynamic<SurfaceViewRendererProps>(
  () => import('@/app/v2/operator/surface/renderers').then((module) => module.OperatorBayTableView),
  { ssr: false },
);
const OperatorQueueView = dynamic<SurfaceViewRendererProps>(
  () => import('@/app/v2/operator/surface/renderers').then((module) => module.OperatorQueueView),
  { ssr: false },
);

export const SURFACE_RENDERER_MODULES: Readonly<
  Record<string, ComponentType<SurfaceViewRendererProps>>
> = {
  table: TableSurfaceView,
  board: BoardSurfaceView,
  card: CardSurfaceView,
  list: ListSurfaceView,
  timeline: TimelineSurfaceView,
  graph: GraphSurfaceView,
  chip: ChipSurfaceView,
<<<<<<< HEAD
=======
  database: DatabaseSurfaceView,
>>>>>>> origin/main
  'operator-attention': OperatorAttentionView,
  'operator-bays': OperatorBaysView,
  'operator-bay-table': OperatorBayTableView,
  'operator-queue': OperatorQueueView,
};

export function resolveSurfaceRenderer(
  renderer: string,
): ComponentType<SurfaceViewRendererProps> | null {
  return SURFACE_RENDERER_MODULES[renderer] ?? null;
}
