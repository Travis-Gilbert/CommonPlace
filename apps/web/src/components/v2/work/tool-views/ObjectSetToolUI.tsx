'use client';

import { useCallback } from 'react';
import { useApiData } from '@/lib/commonplace-api';
import { getWorkBlockHost } from '@/lib/work-surface/work-block-host';
import { pickView } from '@/lib/work-surface/shape-match';
import { objectLabel } from '@/lib/work-surface/tool-result-readers';
import { SURFACE_RENDERER_MODULES } from '@/components/commonplace/surface/surface-renderer-map';
import type { BlockHost, ObjectQuery, ObjectRef } from '@/lib/block-view/types';
import styles from '../work.module.css';

interface ObjectSetToolUIProps {
  readonly query: ObjectQuery;
  readonly host?: BlockHost;
}

/**
 * WS3 fallback tool-call renderer, for the real `objects_loaded` Theseus
 * stage. Resolves the live ObjectSet's catalog view via WorkBlockHost +
 * shape-match's pickView, then hands off to the exact same
 * resolveSurfaceRenderer seam SurfaceRenderer.tsx uses -- no bespoke
 * visualization code duplicated here. `instance`/`config` are synthetic
 * (there is no persisted view-instance object for an ephemeral tool-call
 * render), but the rendered data itself (`set.objects`) is the real query
 * result. Falls back to a plain, honest list when no catalog view matches
 * yet (e.g. the view catalog fetch hasn't settled).
 */
export function ObjectSetToolUI({ query, host }: ObjectSetToolUIProps) {
  const resolvedHost = host ?? getWorkBlockHost();
  const fetchSet = useCallback(() => Promise.resolve(resolvedHost.query(query)), [resolvedHost, query]);
  const { data: set, loading, error } = useApiData(fetchSet, [fetchSet]);

  if (loading && !set) {
    return <div className={styles.toolLoading}>Loading objects&hellip;</div>;
  }
  if (error) {
    return <div className={styles.toolError}>Could not load objects: {error.message}</div>;
  }
  if (!set || set.objects.length === 0) {
    return <div className={styles.toolEmpty}>No matching objects.</div>;
  }

  const descriptor = pickView(resolvedHost.viewsFor(set.shape), set.shape);
  const Renderer = descriptor ? SURFACE_RENDERER_MODULES[descriptor.renderer] : null;

  if (descriptor && Renderer) {
    const instance: ObjectRef = {
      id: `tool-call-view:${descriptor.id}`,
      type: 'view-instance',
      properties: { descriptor_id: descriptor.id },
    };
    return (
      <div className={styles.toolCard}>
        <Renderer set={set} host={resolvedHost} descriptor={descriptor} instance={instance} config={{}} />
      </div>
    );
  }

  return (
    <ul className={styles.toolFallbackList}>
      {set.objects.map((object) => (
        <li key={object.id} className={styles.toolFallbackItem}>
          <span className={styles.toolFallbackType}>{object.type}</span>
          <span>{objectLabel(object)}</span>
        </li>
      ))}
    </ul>
  );
}
