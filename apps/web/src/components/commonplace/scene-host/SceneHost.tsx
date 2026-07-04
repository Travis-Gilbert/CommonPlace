'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  SCENE_PACKAGE_SCHEMA_VERSION,
  validateScenePackage,
  type RenderScenePayload,
  type ScenePackageV2,
  type SceneValidation,
} from '@/lib/scene-package';
import { hasWebGL, sceneRendererFor, SCENE_RENDERER_CATALOG } from './registry';
import type { SceneRendererProps } from './types';

interface SceneHostProps {
  payload: RenderScenePayload;
}

export default function SceneHost({ payload }: SceneHostProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setWebglSupported(hasWebGL()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const renderPlan = useMemo(
    () => planSceneRender(payload, webglSupported),
    [payload, webglSupported],
  );

  if (dismissed) return null;

  const Renderer = renderPlan.entry.component;
  const title = sceneTitle(renderPlan.scenePackage);
  const rendererLabel = renderPlan.entry.label;
  const validationReason = renderPlan.validation.ok ? renderPlan.fallbackReason : renderPlan.validation.reason;

  return (
    <article className="cp-scene-host" data-renderer={renderPlan.entry.id}>
      <header className="cp-scene-host-preview">
        <div>
          <div className="cp-scene-host-kicker">{rendererLabel}</div>
          <h3>{title}</h3>
          <p>
            {renderPlan.scenePackage.atoms.length} items · {renderPlan.scenePackage.relations.length} links
          </p>
          {renderPlan.fallbackReason && (
            <p className="cp-scene-host-reason">{renderPlan.fallbackReason}</p>
          )}
        </div>
        <div className="cp-scene-host-actions">
          <button type="button" onClick={() => setExpanded(true)}>
            Expand
          </button>
          <button type="button" onClick={() => setDismissed(true)}>
            Dismiss
          </button>
        </div>
      </header>

      <div className="cp-scene-host-inline">
        <Suspense fallback={<div className="cp-scene-host-loading">Loading scene...</div>}>
          <Renderer
            scenePackage={renderPlan.scenePackage}
            validationReason={validationReason}
            expanded={false}
          />
        </Suspense>
      </div>

      {expanded && (
        <div className="cp-scene-host-overlay" role="dialog" aria-modal="true" aria-label={title}>
          <div className="cp-scene-host-overlay-bar">
            <div>
              <span>{rendererLabel}</span>
              <strong>{title}</strong>
            </div>
            <button type="button" onClick={() => setExpanded(false)}>
              Close
            </button>
          </div>
          <div className="cp-scene-host-canvas">
            <Suspense fallback={<div className="cp-scene-host-loading">Loading scene...</div>}>
              <Renderer
                scenePackage={renderPlan.scenePackage}
                validationReason={validationReason}
                expanded
              />
            </Suspense>
          </div>
        </div>
      )}
    </article>
  );
}

interface SceneRenderPlan {
  scenePackage: ScenePackageV2;
  validation: SceneValidation;
  fallbackReason?: string;
  entry: NonNullable<ReturnType<typeof sceneRendererFor>>;
}

function planSceneRender(payload: RenderScenePayload, webglSupported: boolean | null): SceneRenderPlan {
  const packageValidation = payload.scene_package
    ? validateScenePackage(payload.scene_package, SCENE_RENDERER_CATALOG)
    : { ok: false, reason: payload.validation.reason ?? 'missing scene_package' };

  if (!payload.scene_package || !packageValidation.ok) {
    const reason = packageValidation.reason ?? 'client validation failed';
    return fallbackPlan(payload.fallback_summary, reason, payload.scene_package ?? undefined);
  }

  const rendererId = payload.scene_package.projection.id;
  const entry = sceneRendererFor(rendererId);
  if (!entry) return fallbackPlan(payload.fallback_summary, `unknown renderer: ${rendererId}`, payload.scene_package);
  if (entry.requiresWebGL && webglSupported === false) {
    return fallbackPlan(payload.fallback_summary, `renderer ${rendererId} requires WebGL`, payload.scene_package);
  }

  return {
    scenePackage: payload.scene_package,
    validation: packageValidation,
    entry,
  };
}

function fallbackPlan(
  fallbackSummary: string,
  reason: string,
  original?: ScenePackageV2,
): SceneRenderPlan {
  const entry = sceneRendererFor('evidence_board');
  if (!entry) throw new Error('evidence_board renderer is required');
  return {
    scenePackage: fallbackEvidencePackage(fallbackSummary, reason, original),
    validation: { ok: false, reason },
    fallbackReason: reason,
    entry,
  };
}

function fallbackEvidencePackage(
  fallbackSummary: string,
  reason: string,
  original?: ScenePackageV2,
): ScenePackageV2 {
  const title = original ? sceneTitle(original) : 'Scene fallback';
  return {
    schema_version: SCENE_PACKAGE_SCHEMA_VERSION,
    version: SCENE_PACKAGE_SCHEMA_VERSION,
    id: original?.id ? `${original.id}-fallback` : 'scene-fallback',
    manifestRef: original?.manifestRef ?? 'manifest:scene-fallback',
    atoms: [
      {
        id: 'fallback-reason',
        kind: 'claim',
        label: 'Scene rendered as fallback',
        lifecycle: 'present',
        metadata: {
          object_type_slug: 'claim',
          body: reason,
        },
      },
      {
        id: 'fallback-summary',
        kind: 'note',
        label: title,
        lifecycle: 'present',
        metadata: {
          object_type_slug: 'note',
          body: fallbackSummary || 'This scene could not be rendered on this client.',
        },
      },
    ],
    relations: [
      {
        id: 'fallback-summary-reason',
        sourceId: 'fallback-reason',
        targetId: 'fallback-summary',
        kind: 'explains',
        lifecycle: 'present',
      },
    ],
    projection: { id: 'evidence_board' },
    chrome: { id: 'commonplace_scene_host' },
    provenance: {
      title,
      fallback_reason: reason,
    },
  };
}

function sceneTitle(scenePackage: ScenePackageV2): string {
  const title = scenePackage.provenance?.title;
  return typeof title === 'string' && title.trim() ? title : scenePackage.id;
}
