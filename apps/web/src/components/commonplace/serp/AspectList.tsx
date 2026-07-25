'use client';

// SOURCING: lucide-react via ../find/RelationGlyph (relation marks) and the
// find overlay's lane vocabulary. The ranked row itself is hand-rolled: a
// lane-and-relation-attributed retrieval row is a domain concept no list
// library models, and it is a <ol> of buttons, not a data grid.

/**
 * Layer two, the plain list (SPEC F5).
 *
 * This renders the SAME `FindResponse` the layer-two constellation projects.
 * The list is mounted through the renderer's `listSlot`, so the toggle between
 * scene and list is a projection change, not a retrieval: no request crosses
 * the wire when the person switches. That is the acceptance criterion, and it
 * is why this component takes a response rather than a query.
 *
 * Each row carries the four attributions the spec names: the title, the snippet
 * with its exact hit emphasized, the lane and relation badges, and the source.
 * Emphasis comes from `FindHit.byteRange` through the existing anchor converter,
 * so the list and the in-page highlight agree on what "the match" is.
 */

import type { FindResponse, FindResult } from '@commonplace/block-view-contracts/search-stack';
import { emphasizeSnippet } from '@/lib/search-stack/byte-range-target';
import { RelationGlyph, relationLabel } from '../find/RelationGlyph';
import { LANE_CHIP_LABEL, chipForLane } from '../find/useFindOverlay';
import styles from './serp.module.css';

export function AspectList({
  response,
  onOpen,
}: {
  response: FindResponse;
  onOpen?: (result: FindResult) => void;
}) {
  // The needle is the query the EXECUTOR answered, which for an aspect is the
  // question narrowed by the aspect label. Emphasizing against the root question
  // instead would miss every hit the aspect term found.
  const query = response.query;
  if (response.results.length === 0) {
    return (
      <p className={styles.listEmpty}>
        The lanes ran and admitted nothing for this aspect. Widen the question or pick another
        aspect.
      </p>
    );
  }

  return (
    <ol className={styles.list} aria-label={`Results for ${response.query}`}>
      {response.results.map((result, index) => (
        <li key={`${result.hit.doc}-${result.hit.byteRange.start}-${index}`}>
          <button
            type="button"
            className={styles.row}
            data-relation={result.relation}
            onClick={() => onOpen?.(result)}
          >
            <span className={styles.rowRank}>{index + 1}</span>
            <span className={styles.rowBody}>
              <span className={styles.rowTitle}>{result.hit.title ?? result.hit.doc}</span>
              <Snippet result={result} query={query} />
              <span className={styles.rowMeta}>
                <span className={styles.laneBadge} data-lane={result.hit.lane}>
                  {LANE_CHIP_LABEL[chipForLane(result.hit.lane)]}
                </span>
                <span className={styles.relationBadge} data-relation={result.relation}>
                  <RelationGlyph relation={result.relation} decorative />
                  {relationLabel(result.relation)}
                </span>
                {result.hit.source ? (
                  <span className={styles.rowSource}>{hostOf(result.hit.source)}</span>
                ) : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * The snippet with its exact hit emphasized. When the match is meaning rather
 * than characters (semantic and graph lanes), there is nothing honest to
 * emphasize and the snippet renders plain.
 */
function Snippet({ result, query }: { result: FindResult; query: string }) {
  const snippet = result.hit.snippet;
  if (!snippet) return null;
  const emphasis = emphasizeSnippet(result.hit, { query });
  if (!emphasis) return <span className={styles.rowSnippet}>{snippet}</span>;
  return (
    <span className={styles.rowSnippet}>
      {emphasis.before}
      <mark className={styles.rowHit}>{emphasis.match}</mark>
      {emphasis.after}
    </span>
  );
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./, '') : url;
}
