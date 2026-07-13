'use client';

import { Plus, X } from 'lucide-react';
import type { IndexDestination, WatchQuery } from '@/lib/commonplace/index-queries';

/* Destination rail (HANDOFF-INDEX IX7): the pane left of the stream, on the
   console register. Destinations are derived from the loaded rows: every one
   shown has real items and an exact count, and selecting it filters the stream.
   Watch queries are saved searches that behave the same way. Flat register:
   state is tone (bg-cr-top + hairline), never relief. */

const ITEM =
  'group flex w-full cursor-pointer items-center gap-cr-2 rounded-cr border border-transparent ' +
  'px-cr-2 py-cr-1 text-left text-cr-small font-cr-ui text-cr-ink-2 transition-colors duration-chrome ' +
  'ease-cr hover:bg-cr-top hover:text-cr-ink focus-visible:[outline:2px_solid_var(--cr-signal)] ' +
  'focus-visible:outline-offset-1 aria-[current=true]:border-cr-hairline aria-[current=true]:bg-cr-top ' +
  'aria-[current=true]:text-cr-ink';

const SECTION_LABEL =
  'font-cr-mono text-cr-caption uppercase tracking-[0.08em] text-cr-ink-3';

function Count({ n }: { n: number }) {
  return (
    <span className="ml-auto shrink-0 font-cr-mono text-cr-caption tabular-nums text-cr-ink-3">
      {n}
    </span>
  );
}

interface IndexRailProps {
  destinations: readonly IndexDestination[];
  totalCount: number;
  activeDestination: string | null;
  onSelectDestination: (key: string | null) => void;
  watchQueries: readonly WatchQuery[];
  countForQuery: (query: string) => number;
  activeQuery: string;
  onApplyWatch: (query: string) => void;
  onSaveWatch: (label: string) => void;
  onRemoveWatch: (id: string) => void;
}

export function IndexRail({
  destinations,
  totalCount,
  activeDestination,
  onSelectDestination,
  watchQueries,
  countForQuery,
  activeQuery,
  onApplyWatch,
  onSaveWatch,
  onRemoveWatch,
}: IndexRailProps) {
  const trimmedQuery = activeQuery.trim();
  const alreadySaved = watchQueries.some(
    (q) => q.query.trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canSave = trimmedQuery.length > 0 && !alreadySaved;

  return (
    <nav
      aria-label="Destinations"
      className="flex h-full min-h-0 flex-col gap-cr-3 overflow-y-auto bg-cr-surface px-cr-2 py-cr-3"
    >
      <section className="flex flex-col gap-[2px]">
        <div className="px-cr-2 pb-cr-1">
          <span className={SECTION_LABEL}>Filed to</span>
        </div>
        <button
          type="button"
          className={ITEM}
          aria-current={activeDestination === null ? 'true' : undefined}
          onClick={() => onSelectDestination(null)}
        >
          <span className="truncate">All</span>
          <Count n={totalCount} />
        </button>
        {destinations.map((dest) => (
          <button
            key={dest.key}
            type="button"
            className={ITEM}
            aria-current={activeDestination === dest.key ? 'true' : undefined}
            onClick={() => onSelectDestination(dest.key)}
            title={dest.label}
          >
            <span className="truncate">{dest.label}</span>
            <Count n={dest.count} />
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-[2px]">
        <div className="flex items-center justify-between px-cr-2 pb-cr-1">
          <span className={SECTION_LABEL}>Watch queries</span>
          {canSave && (
            <button
              type="button"
              onClick={() => onSaveWatch(trimmedQuery)}
              className="flex cursor-pointer items-center gap-cr-1 font-cr-mono text-cr-caption uppercase tracking-[0.05em] text-cr-ink-3 transition-colors duration-chrome ease-cr hover:text-cr-signal focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
            >
              <Plus className="size-[0.9em]" aria-hidden="true" />
              Save search
            </button>
          )}
        </div>
        {watchQueries.length === 0 ? (
          <p className="px-cr-2 text-cr-small leading-snug text-cr-ink-3">
            Search the index, then save it to watch what lands in it.
          </p>
        ) : (
          watchQueries.map((wq) => {
            const active = wq.query.trim().toLowerCase() === trimmedQuery.toLowerCase();
            return (
              <div key={wq.id} className="group/wq relative flex items-center">
                <button
                  type="button"
                  className={`${ITEM} pr-cr-4`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onApplyWatch(wq.query)}
                  title={`Search: ${wq.query}`}
                >
                  <span className="truncate">{wq.label}</span>
                  <Count n={countForQuery(wq.query)} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove watch query ${wq.label}`}
                  onClick={() => onRemoveWatch(wq.id)}
                  className="absolute right-cr-1 flex size-[20px] cursor-pointer items-center justify-center rounded-cr-sm text-cr-ink-3 opacity-0 transition-opacity duration-chrome ease-cr hover:text-cr-signal focus-visible:opacity-100 focus-visible:[outline:2px_solid_var(--cr-signal)] group-hover/wq:opacity-100"
                >
                  <X className="size-[0.85em]" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </section>
    </nav>
  );
}
