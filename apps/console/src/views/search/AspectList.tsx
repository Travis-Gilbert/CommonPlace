'use client';

// SOURCING: @commonplace/search-stack exact-hit emphasis. The ranked rows are
// rebuilt against the console record grammar and register tokens.

import {
  LANE_CHIP_LABEL,
  chipForLane,
  emphasizeSnippet,
  type FindResponse,
  type FindResult,
} from '@commonplace/search-stack';
import { RelationMark, relationLabel } from './RelationMark';

export function AspectList({
  response,
  onOpen,
}: {
  readonly response: FindResponse;
  readonly onOpen?: (result: FindResult) => void;
}) {
  if (response.results.length === 0) {
    return (
      <p className="p-4 text-ij-ink-info">
        The lanes ran and admitted nothing for this aspect. Widen the question
        or pick another aspect.
      </p>
    );
  }

  return (
    <ol
      aria-label={`Results for ${response.query}`}
      className="m-0 grid list-none gap-1 p-0"
    >
      {response.results.map((result, index) => (
        <li key={`${result.hit.doc}-${result.hit.byteRange.start}-${index}`}>
          <button
            type="button"
            data-relation={result.relation}
            onClick={() => onOpen?.(result)}
            className="flex w-full items-start gap-3 border-b border-ij-seam px-3 py-3 text-left text-ij-ink hover:bg-ij-hover-surface focus:outline-2 focus:outline-ij-accent"
            style={{ transition: 'var(--rec-clickable-transition)' }}
          >
            <span className="shrink-0 font-ij-mono text-ij-island-meta tabular-nums text-ij-ink-disabled">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{result.hit.title ?? result.hit.doc}</span>
              <Snippet result={result} query={response.query} />
              <span className="mt-1 flex flex-wrap items-center gap-2 font-ij-mono text-ij-island-meta uppercase text-ij-ink-info">
                <span className="rounded-ij-arc-underline border border-ij-control-border px-1">
                  {LANE_CHIP_LABEL[chipForLane(result.hit.lane)]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-ij-arc-underline border border-ij-control-border px-1">
                  <RelationMark relation={result.relation} decorative />
                  {relationLabel(result.relation)}
                </span>
                {result.hit.source ? <span>{hostOf(result.hit.source)}</span> : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Snippet({
  result,
  query,
}: {
  readonly result: FindResult;
  readonly query: string;
}) {
  const snippet = result.hit.snippet;
  if (!snippet) return null;
  const emphasis = emphasizeSnippet(result.hit, { query });
  if (!emphasis) {
    return <span className="mt-1 block text-ij-ink-info">{snippet}</span>;
  }
  return (
    <span className="mt-1 block text-ij-ink-info">
      {emphasis.before}
      <mark className="bg-ij-search-match font-semibold text-ij-ink">
        {emphasis.match}
      </mark>
      {emphasis.after}
    </span>
  );
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./, '') : url;
}
