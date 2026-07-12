'use client';

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  DEFAULT_RENDERER_CAPABILITIES,
  type RendererCapability,
  type RendererCatalog,
} from '@/lib/scene-package';
import type { SceneRendererProps } from './types';

export interface SceneRendererEntry {
  id: string;
  label: string;
  capability: RendererCapability;
  component: LazyExoticComponent<ComponentType<SceneRendererProps>>;
  requiresWebGL?: boolean;
  fallbackRenderer?: string;
}

export const SCENE_RENDERER_REGISTRY: Record<string, SceneRendererEntry> = {
  evidence_board: rendererEntry(
    'evidence_board',
    lazy(() => import('./renderers/EvidenceBoardRenderer')),
  ),
  graph_neighborhood: rendererEntry(
    'graph_neighborhood',
    lazy(() => import('./renderers/GraphNeighborhoodRenderer')),
    { requiresWebGL: true },
  ),
  table: rendererEntry('table', lazy(() => import('./renderers/TableRenderer'))),
  chart: rendererEntry('chart', lazy(() => import('./renderers/ChartRenderer'))),
  mechanism_diagram: rendererEntry(
    'mechanism_diagram',
    lazy(() => import('./renderers/MechanismDiagramRenderer')),
  ),
  model_3d: rendererEntry(
    'model_3d',
    lazy(() => import('./renderers/Model3dRenderer')),
    { requiresWebGL: true },
  ),
  patent_diagram: rendererEntry(
    'patent_diagram',
    lazy(() => import('./renderers/PatentDiagramRenderer')),
  ),
};

export const SCENE_RENDERER_CATALOG: RendererCatalog = Object.fromEntries(
  Object.entries(SCENE_RENDERER_REGISTRY).map(([id, entry]) => [id, entry.capability]),
);

export function sceneRendererFor(id: string): SceneRendererEntry | undefined {
  return SCENE_RENDERER_REGISTRY[id];
}

export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
}

function rendererEntry(
  id: string,
  component: LazyExoticComponent<ComponentType<SceneRendererProps>>,
  options: { requiresWebGL?: boolean } = {},
): SceneRendererEntry {
  const capability = DEFAULT_RENDERER_CAPABILITIES[id];
  if (!capability) {
    throw new Error(`Scene renderer ${id} is missing from DEFAULT_RENDERER_CAPABILITIES`);
  }
  return {
    id,
    label: capability.label,
    capability,
    component,
    requiresWebGL: options.requiresWebGL,
    fallbackRenderer: capability.fallbackRenderer,
  };
}
