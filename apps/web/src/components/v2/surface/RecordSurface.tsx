'use client';

/**
 * TW5 RecordSurface: one ObjectQuery, one live ObjectSet, and a one-press flip
 * across the renderers that accept its shape.
 *
 * The switcher swaps the active ViewDescriptor over the SAME set (no re-query,
 * no code paths), which is the spec's "flip". Data is live through
 * `createWorkBlockHost` -> the `/api/theorem/objects` proxy; there is no mock
 * path here. An empty or unreachable instance renders an honest state.
 *
 * Cross-surface selection preservation across the flip is intentionally not
 * wired yet: it lands with the TW6 state-boundary work (see
 * docs/plans/twenty-recon). What ships here is the shared query plus the
 * shape-gated, one-press descriptor swap, as an APG tablist.
 */

import { useEffect, useMemo, useRef, useState, type FC, type KeyboardEvent } from 'react';
import type { ObjectQuery, ObjectSet } from '@/lib/block-view/types';
import { createWorkBlockHost } from '@/lib/work-surface/work-block-host';
import { matchingViews } from '@/lib/work-surface/view-registry';
import styles from './record-surface.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly set: ObjectSet };

export interface RecordSurfaceProps {
  /** Pass a stable reference: an inline object re-runs the fetch effect every render. */
  readonly query: ObjectQuery;
}

export const RecordSurface: FC<RecordSurfaceProps> = ({ query }) => {
  const host = useMemo(() => createWorkBlockHost(), []);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [activeId, setActiveId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    // Initial state is 'loading'; the async callbacks below settle it. (Setting
    // state synchronously here would trip react-hooks/set-state-in-effect.)
    // BlockHost.query is MaybePromise<ObjectSet>; normalize so both sync and async hosts work.
    Promise.resolve(host.query(query))
      .then((set) => {
        if (alive) setState({ status: 'ready', set });
      })
      .catch((error: unknown) => {
        if (alive) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Query failed.',
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [host, query]);

  const views = useMemo(
    () => (state.status === 'ready' ? matchingViews(state.set.shape) : []),
    [state],
  );

  const activeView = useMemo(() => {
    if (!views.length) return null;
    return views.find((view) => view.id === activeId) ?? views[0];
  }, [views, activeId]);

  if (state.status === 'loading') {
    return (
      <div className={styles.status} role="status">
        <p className={styles.statusBody}>Loading records.</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={styles.status} role="alert">
        <p className={styles.statusTitle}>Records unavailable</p>
        <p className={styles.statusBody}>{state.message}</p>
      </div>
    );
  }

  if (!state.set.objects.length || !activeView) {
    return (
      <div className={styles.status} role="status">
        <p className={styles.statusTitle}>No records yet</p>
        <p className={styles.statusBody}>Nothing matches this query on the connected instance.</p>
      </div>
    );
  }

  const active = activeView;
  const Renderer = active.render;

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = views.findIndex((view) => view.id === active.id);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % views.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + views.length) % views.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = views.length - 1;
    else return;
    event.preventDefault();
    setActiveId(views[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.surface}>
      <div
        role="tablist"
        aria-label="Record views"
        className={styles.switcher}
        onKeyDown={onTabKeyDown}
      >
        {views.map((view, i) => {
          const selected = view.id === active.id;
          return (
            <button
              key={view.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`recordview-tab-${view.id}`}
              aria-selected={selected}
              aria-controls={`recordview-panel-${view.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              data-selected={selected || undefined}
              // Press-down activation (SPEC-UX-PHYSICS D5): a tab switch is idempotent,
              // so it fires on primary pointer-down for a crisp flip; onClick keeps
              // keyboard activation (roving tabindex handles arrow navigation).
              onPointerDown={(e) => { if (e.button === 0) setActiveId(view.id); }}
              onClick={() => setActiveId(view.id)}
            >
              {view.name}
            </button>
          );
        })}
      </div>

      {views.map((view) => {
        const selected = view.id === active.id;
        // A panel element exists for every tab id so each tab's aria-controls
        // target is real; only the active panel is shown and mounts a renderer,
        // keeping the flip to one renderer over one ObjectSet.
        return (
          <div
            key={view.id}
            role="tabpanel"
            id={`recordview-panel-${view.id}`}
            aria-labelledby={`recordview-tab-${view.id}`}
            tabIndex={-1}
            className={styles.panel}
            hidden={!selected}
          >
            {selected ? <Renderer set={state.set} host={host} /> : null}
          </div>
        );
      })}
    </div>
  );
};
