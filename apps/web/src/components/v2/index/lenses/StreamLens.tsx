'use client';

import { useMemo } from 'react';
import {
  FileText,
  Link2,
  Mic,
  SquareCheck,
  CircleHelp,
  TriangleAlert,
  CalendarClock,
  NotebookPen,
} from 'lucide-react';
import {
  indexRowKey,
  type IndexBandId,
  type IndexRow,
  type IndexRowDestination,
  type IndexRowKind,
} from '@/lib/commonplace/index-queries';
import type { LensProps } from '@/lib/v2/lenses/types';
import { TagChip } from '@/components/v2/TagChip';

/* Stream lens: the IX7 triage view, now a lens over the shell's filtered rows
   and reskinned onto the flat console register (cr-*). No porcelain, no
   p-band/p-row, no CSS module: flat sections separated by sticky small-caps
   dividers, selection shown by elevation (bg-cr-top) not relief. */

const KIND_GLYPH: Record<IndexRowKind, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  link: Link2,
  voice: Mic,
  task: SquareCheck,
  question: CircleHelp,
  tension: TriangleAlert,
  event: CalendarClock,
  note: NotebookPen,
};

const KIND_WORD: Partial<Record<IndexRowKind, string>> = {
  task: 'task',
  question: 'open question',
  event: 'event',
  note: 'note',
};

const BAND_META: Record<IndexBandId, { title: string; sub: string }> = {
  landed: { title: 'What landed', sub: 'Filed while you were away. Fix anything that is off.' },
  open: { title: 'What is open', sub: 'Loose ends, whenever you are ready.' },
  today: { title: 'What today holds', sub: 'Anchored to today.' },
};

const BAND_ORDER: IndexBandId[] = ['landed', 'open', 'today'];

function RowSubtitle({
  row,
  destination,
}: {
  row: IndexRow;
  destination: IndexRowDestination | null;
}) {
  // Tags render on every row that carries them, not only landed/filed ones.
  const tags = row.tags.map((tag) => <TagChip key={tag} tag={tag} />);
  const wrap =
    'mt-[2px] flex flex-wrap items-center gap-x-cr-2 gap-y-[2px] text-cr-caption text-cr-ink-3';

  if (row.isTension) {
    return (
      <span className={wrap}>
        <span className="inline-flex items-center gap-cr-1 text-cr-signal">
          <span className="size-[5px] rounded-full bg-cr-signal" />
          tension
        </span>
        {row.meta && <span className="text-cr-ink-3">{row.meta}</span>}
        {tags}
      </span>
    );
  }
  if (row.band === 'landed' && destination) {
    return (
      <span className={wrap}>
        <span className="text-cr-ink-3/70">{destination.verb}</span>
        <span className="text-cr-ink-2">{destination.label}</span>
        {tags}
      </span>
    );
  }
  const word = KIND_WORD[row.kind];
  const showWord = word && row.band === 'open';
  if (!showWord && !row.meta && tags.length === 0) return null;
  return (
    <span className={wrap}>
      {showWord && <span>{word}</span>}
      {row.meta && <span>{row.meta}</span>}
      {tags}
    </span>
  );
}

function Row({
  row,
  selected,
  destination,
  onSelect,
}: {
  row: IndexRow;
  selected: boolean;
  destination: IndexRowDestination | null;
  onSelect: (key: string) => void;
}) {
  const Glyph = KIND_GLYPH[row.kind] ?? FileText;
  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(indexRowKey(row))}
      className="group flex min-h-row w-full items-center gap-cr-2 rounded-cr border border-transparent px-cr-2 py-cr-1 text-left transition-colors duration-chrome ease-cr hover:bg-cr-top aria-[current=true]:border-cr-hairline aria-[current=true]:bg-cr-top focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-[-2px]"
    >
      {row.band === 'today' ? (
        <span
          className={`w-[3.5rem] shrink-0 font-cr-mono text-cr-caption tabular-nums ${
            row.whenSoft ? 'text-cr-ink-3' : 'text-cr-ink-2'
          }`}
        >
          {row.when}
        </span>
      ) : (
        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-cr-sm bg-cr-ground text-cr-ink-2">
          <Glyph className="size-[14px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-cr-ui text-cr-body text-cr-ink">{row.title}</span>
        <RowSubtitle row={row} destination={destination} />
      </span>
    </button>
  );
}

function Band({
  band,
  rows,
  selectedKey,
  onSelect,
  destinationFor,
}: {
  band: IndexBandId;
  rows: readonly IndexRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  destinationFor: (row: IndexRow) => IndexRowDestination | null;
}) {
  if (rows.length === 0) return null;
  const meta = BAND_META[band];
  return (
    <section aria-label={meta.title} className="flex flex-col">
      <div className="sticky top-0 z-[2] mb-cr-1 flex flex-wrap items-baseline gap-x-cr-2 gap-y-[1px] border-b border-cr-hairline bg-cr-surface px-cr-2 pb-cr-1 pt-cr-2">
        <span className="font-cr-mono text-cr-caption uppercase tracking-[0.12em] text-cr-ink-3">
          {band}
        </span>
        <h2 className="font-cr-ui text-cr-h4 font-semibold text-cr-ink">{meta.title}</h2>
        <span className="text-cr-small text-cr-ink-3">{meta.sub}</span>
      </div>
      <div className="flex flex-col px-cr-1 pb-cr-2">
        {rows.map((row) => (
          <Row
            key={indexRowKey(row)}
            row={row}
            selected={indexRowKey(row) === selectedKey}
            destination={destinationFor(row)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function StreamLens({ rows, selectedKey, onSelect, destinationFor }: LensProps) {
  const total = rows.length;
  // Group by band in one pass rather than filtering the whole list once per band.
  const byBand = useMemo(() => {
    const groups: Record<IndexBandId, IndexRow[]> = { landed: [], open: [], today: [] };
    for (const row of rows) groups[row.band]?.push(row);
    return groups;
  }, [rows]);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-cr-surface">
      {total === 0 ? (
        <p className="m-auto max-w-[34ch] px-cr-3 py-cr-5 text-center text-cr-small text-cr-ink-3">
          Nothing matches. Clear the filter, or widen the search.
        </p>
      ) : (
        <div className="flex flex-col gap-cr-2 px-cr-3 py-cr-2">
          {BAND_ORDER.map((band) => (
            <Band
              key={band}
              band={band}
              rows={byBand[band]}
              selectedKey={selectedKey}
              onSelect={onSelect}
              destinationFor={destinationFor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
