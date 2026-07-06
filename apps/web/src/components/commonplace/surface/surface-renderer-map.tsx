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
// The rich Anytype-grade Set view, registered as the `database` renderer.
const DatabaseSurfaceView = dynamic<SurfaceViewRendererProps>(
  () => import('@/lib/block-view/database/DatabaseSurfaceView').then((module) => module.DatabaseSurfaceView),
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
  database: DatabaseSurfaceView,
};

export function resolveSurfaceRenderer(
  renderer: string,
): ComponentType<SurfaceViewRendererProps> | null {
  return SURFACE_RENDERER_MODULES[renderer] ?? null;
}
