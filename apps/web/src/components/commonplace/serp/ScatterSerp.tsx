'use client';

// SOURCING: the existing ConstellationRenderer (registered under force_graph) is
// the scene; @base-ui/react/slider carries the lambda dial; AskBar is the
// CommonPlace ask composer. This file is the wiring between them, which is the
// product's own two-layer search behaviour and has no upstream equivalent.

/**
 * The scatter SERP (SPEC F2 + F3 + F5, HANDOFF-SEARCH-CONSTELLATION D2/D4).
 *
 * Submitting in ask mode scatters the question into aspects and renders them as
 * the constellation. That constellation is the results surface, not a preview
 * of one.
 *
 * Two layers, one graph:
 *
 *   layer one   aspects. Click a node to open layer two. Double click (or press
 *               E) to re-scatter inside it.
 *   layer two   the aspect's results. Click a node to open the page on the
 *               co-browse stage; the constellation docks rather than closing.
 *
 * The plain-list toggle the renderer already owns is where F5 mounts. At layer
 * two the scene and the list are two projections of ONE `FindResponse` the store
 * already holds, so toggling costs nothing and switching layers back and forth
 * costs nothing. The store is the breadcrumb: neither opening a list nor opening
 * a page destroys it, and coming back finds it exactly as it was.
 */

import { useCallback, useMemo, useState } from 'react';
import type {
  AspectNode,
  ConstellationNode,
  FindResult,
} from '@commonplace/block-view-contracts/search-stack';
import { ConstellationSurface } from '../scene-host/renderers/ConstellationRenderer';
import { RelationGlyph, relationLabel } from '../find/RelationGlyph';
import AskBar from '../ask/AskBar';
import {
  constellationStateOf,
  scatterOf,
  selectedFindOf,
  useSearchStack,
} from '@/lib/search-stack/store';
import { AspectList } from './AspectList';
import { LambdaDial } from './LambdaDial';
import styles from './serp.module.css';

export interface ScatterSerpProps {
  /** The co-browse session the openings belong to, for the D4 bundle origin. */
  sessionId: string | null;
  /** Real navigation into the co-browse stage. Owned by the host surface. */
  onOpenPage: (url: string, node: ConstellationNode) => Promise<void>;
}

export default function ScatterSerp({ sessionId, onOpenPage }: ScatterSerpProps) {
  const state = useSearchStack();
  const [draft, setDraft] = useState('');

  const scatter = scatterOf(state);
  const find = selectedFindOf(state);
  const constellationState = useMemo(() => constellationStateOf(state), [state]);

  const aspectLabel = useMemo(() => {
    if (!state.selectedAspect || !scatter) return null;
    return scatter.aspects.find((aspect) => aspect.id === state.selectedAspect)?.label ?? null;
  }, [state.selectedAspect, scatter]);

  const openNode = useCallback(
    (node: ConstellationNode) => {
      void state.openNode(node, { sessionId, open: onOpenPage });
    },
    [state, sessionId, onOpenPage],
  );

  // A node click means "open this" at both layers; what "open" means is what
  // differs. Layer one opens an aspect, layer two opens a page.
  const handleOpenResult = useCallback(
    (_url: string, node: ConstellationNode) => {
      if (state.layer === 'scatter') {
        void state.selectAspect(node.id);
        return;
      }
      openNode(node);
    },
    [state, openNode],
  );

  const handleExpand = useCallback(
    (node: ConstellationNode) => {
      if (state.layer !== 'scatter') return;
      void state.expandAspect(node.id);
    },
    [state],
  );

  const openFromList = useCallback(
    (result: FindResult) => {
      const url = result.hit.source;
      if (!url) return;
      openNode({
        id: result.hit.doc,
        url,
        title: result.hit.title ?? result.hit.doc,
        description: result.hit.snippet,
        admittedRank: 1,
        relation: result.relation,
      });
    },
    [openNode],
  );

  const listSlot =
    state.layer === 'aspect' && find ? (
      <AspectList response={find} onOpen={openFromList} />
    ) : (
      <AspectRoster
        aspects={scatter?.aspects ?? []}
        labeler={scatter?.labeler}
        onOpen={(id) => void state.selectAspect(id)}
        onExpand={(id) => void state.expandAspect(id)}
        expanding={state.expanding}
      />
    );

  return (
    <section className={styles.serp} aria-label="Search results" data-layer={state.layer}>
      <div className={styles.composerRow}>
        <AskBar
          value={draft}
          onChange={setDraft}
          onSubmit={(question) => void state.submit(question)}
          active={state.layer === 'aspect'}
        />
        <LambdaDial lambda={state.lambda} onChange={state.setLambda} />
      </div>

      <nav className={styles.crumbs} aria-label="Search layers">
        <button
          type="button"
          className={styles.crumb}
          data-current={state.layer === 'scatter' ? 'true' : undefined}
          onClick={state.backToScatter}
          disabled={state.layer === 'scatter'}
        >
          Aspects
        </button>
        {aspectLabel ? (
          <>
            <span className={styles.crumbSep} aria-hidden="true">
              /
            </span>
            <span className={styles.crumb} data-current="true">
              {aspectLabel}
            </span>
          </>
        ) : null}
        {state.expanding ? (
          <span className={styles.crumbNote} role="status">
            Re-scattering {state.expanding}
          </span>
        ) : null}
      </nav>

      <ConstellationSurface
        state={constellationState}
        listSlot={listSlot}
        onOpenResult={handleOpenResult}
        onExpandNode={state.layer === 'scatter' ? handleExpand : undefined}
        onEditQuery={(question) => void state.submit(question)}
        onRetry={() => {
          if (state.layer === 'aspect' && state.selectedAspect) {
            void state.selectAspect(state.selectedAspect);
            return;
          }
          void state.submit(state.query);
        }}
      />
    </section>
  );
}

/**
 * Layer one's plain list: the aspects themselves. The renderer's toggle reveals
 * this, so the scatter surface has a non-graph reading too, and both of an
 * aspect's gestures (open, expand) are reachable without the canvas.
 */
function AspectRoster({
  aspects,
  labeler,
  onOpen,
  onExpand,
  expanding,
}: {
  aspects: readonly AspectNode[];
  labeler?: string;
  onOpen: (id: string) => void;
  onExpand: (id: string) => void;
  expanding: string | null;
}) {
  if (aspects.length === 0) {
    return <p className={styles.listEmpty}>No aspect has been scattered yet.</p>;
  }
  return (
    <ol className={styles.list} aria-label="Aspects">
      {aspects.map((aspect, index) => (
        <li key={aspect.id}>
          <div className={styles.row} data-relation={aspect.relation}>
            <span className={styles.rowRank}>{index + 1}</span>
            <span className={styles.rowBody}>
              <span className={styles.rowTitle}>{aspect.label}</span>
              <span className={styles.rowMeta}>
                <span className={styles.relationBadge} data-relation={aspect.relation}>
                  <RelationGlyph relation={aspect.relation} decorative />
                  {relationLabel(aspect.relation)}
                </span>
                <span className={styles.rowSource}>
                  {aspect.seedHits.length === 1 ? '1 seed' : `${aspect.seedHits.length} seeds`}
                </span>
                {labeler ? <span className={styles.rowSource}>labeled by {labeler}</span> : null}
              </span>
            </span>
            <span className={styles.rowActions}>
              <button type="button" className={styles.rowAction} onClick={() => onOpen(aspect.id)}>
                Open
              </button>
              <button
                type="button"
                className={styles.rowAction}
                onClick={() => onExpand(aspect.id)}
                disabled={expanding === aspect.id}
              >
                {expanding === aspect.id ? 'Expanding' : 'Expand'}
              </button>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
