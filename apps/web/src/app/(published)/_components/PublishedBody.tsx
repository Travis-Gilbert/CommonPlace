'use client';

import SceneHost from '@/components/commonplace/scene-host/SceneHost';
import { isRenderScenePayload, type RenderScenePayload } from '@/lib/scene-package';

import { GalleyContent } from './GalleyContent';
import styles from '../published.module.css';

/**
 * Render a published block's body by shape (HANDOFF-PUBLISH P2.1). A block that
 * carries a renderable scene package (dashboard, scene, chart, table, diagram)
 * renders through the same SceneHost the product uses, so a published dashboard
 * or scene renders logged out. Text-shaped blocks (doc, note, log, reference)
 * render through Galley. A block with neither shows an honest empty state.
 */
function sceneFrom(payload: unknown): RenderScenePayload | null {
  if (isRenderScenePayload(payload)) return payload;
  const extra = (payload as { extra?: unknown } | null)?.extra ?? null;
  if (isRenderScenePayload(extra)) return extra;
  const wrapped = extra as { scene?: unknown; scene_package?: unknown; payload?: unknown } | null;
  for (const candidate of [wrapped?.scene, wrapped?.scene_package, wrapped?.payload]) {
    if (isRenderScenePayload(candidate)) return candidate;
  }
  return null;
}

export function PublishedBody({
  payload,
  text,
  kind,
}: {
  payload: unknown;
  text: string | null;
  kind: string;
}) {
  const scene = sceneFrom(payload);
  if (scene) {
    return <SceneHost payload={scene} />;
  }
  if (text) {
    return <GalleyContent markdown={text} kind={kind} />;
  }
  return (
    <div className={`${styles.body} ${styles.bodyEmpty}`}>
      This block has no renderable content to display.
    </div>
  );
}
