'use client';

import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  allRows,
  isNeedsYou,
  type IndexBandId,
  type IndexData,
  type IndexRow,
  type IndexRowDestination,
  type IndexRowKind,
} from '@/lib/commonplace/index-queries';
import styles from './index.module.css';

/* List pane (HANDOFF-INDEX-SURFACE D2): three bands in a fixed order, a segmented
   All / Needs-you filter (no counts), and a scoped search. Rows are selection
   buttons; a band virtualizes its rows once it exceeds the threshold. Rendering
   stays polymorphic -- one Row for every kind, no band-specific row component. */

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

const VIRTUALIZE_THRESHOLD = 60;
const ROW_EST = 58;

function RowSubtitle({ row, destination }: { row: IndexRow; destination: IndexRowDestination | null }) {
  if (row.isTension) {
    return (
      <span className="p-rs">
        <span className="p-flag">
          <span className="p-flagdot" />
          tension
        </span>
        {row.meta && (
          <>
            <span className="p-sep">&#183;</span>
            {row.meta}
          </>
        )}
      </span>
    );
  }
  if (row.band === 'landed' && destination) {
    return (
      <span className="p-rs">
        <span className="p-sep">{destination.verb}</span>
        <span className="p-dest">{destination.label}</span>
        {row.tags.map((tag) => (
          <span key={tag} className="p-tag">
            {tag}
          </span>
        ))}
      </span>
    );
  }
  const word = KIND_WORD[row.kind];
  return (
    <span className="p-rs">
      {word && row.band === 'open' && (
        <>
          {word}
          {row.meta && <span className="p-sep">&#183;</span>}
        </>
      )}
      {row.meta}
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
  onSelect: (id: string) => void;
}) {
  const Glyph = KIND_GLYPH[row.kind] ?? FileText;
  return (
    <button
      type="button"
      className={`p-row ${styles.rowBtn} ${selected ? styles.rowSelected : ''} ${
        row.isTension ? 'is-tension' : ''
      }`}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(row.id)}
    >
      {row.band === 'today' ? (
        <span className={`p-when ${row.whenSoft ? 'is-soft' : ''}`}>{row.when}</span>
      ) : (
        <span className="p-ic">
          <Glyph className="p-glyph" />
        </span>
      )}
      <span className="p-rc">
        <span className="p-rt">{row.title}</span>
        <RowSubtitle row={row} destination={destination} />
      </span>
    </button>
  );
}

function Band({
  band,
  rows,
  selectedId,
  onSelect,
  destinationFor,
}: {
  band: IndexBandId;
  rows: readonly IndexRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  destinationFor: (row: IndexRow) => IndexRowDestination | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > VIRTUALIZE_THRESHOLD;
  // Hook is called unconditionally (rules of hooks); its output is only used in
  // the virtualized branch, where the scroll element is attached.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_EST,
    overscan: 8,
  });

  if (rows.length === 0) return null;
  const meta = BAND_META[band];

  return (
    <section className="p-band" aria-label={meta.title}>
      <div className="p-bandh">
        <h2 className="p-bandtitle">{meta.title}</h2>
        <span className="p-bandsub">{meta.sub}</span>
      </div>
      {virtualize ? (
        <div ref={scrollRef} className={styles.bandViewport}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              return (
                <div
                  key={row.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <Row
                    row={row}
                    selected={row.id === selectedId}
                    destination={destinationFor(row)}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            selected={row.id === selectedId}
            destination={destinationFor(row)}
            onSelect={onSelect}
          />
        ))
      )}
    </section>
  );
}

interface IndexListProps {
  data: IndexData;
  selectedId: string | null;
  onSelect: (id: string) => void;
  destinationFor: (row: IndexRow) => IndexRowDestination | null;
}

export function IndexList({ data, selectedId, onSelect, destinationFor }: IndexListProps) {
  const [tab, setTab] = useState<'all' | 'needs'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = (row: IndexRow) => {
    if (tab === 'needs' && !isNeedsYou(row)) return false;
    if (!q) return true;
    const hay = [row.title, ...row.tags, row.destination?.label ?? '', row.meta ?? '']
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };

  const bands: IndexBandId[] = ['landed', 'open', 'today'];
  const visibleByBand = bands.map((band) => ({
    band,
    rows: data.bands[band].filter(matches),
  }));
  const total = allRows(data).filter(matches).length;

  return (
    <>
      <div className={styles.listTop}>
        <div className={styles.tabs} role="group" aria-label="Filter">
          <button
            type="button"
            className={styles.tab}
            aria-pressed={tab === 'all'}
            onClick={() => setTab('all')}
          >
            All
          </button>
          <button
            type="button"
            className={styles.tab}
            aria-pressed={tab === 'needs'}
            onClick={() => setTab('needs')}
          >
            Needs you
          </button>
        </div>
        <input
          type="search"
          className={styles.search}
          value={query}
          placeholder="Search the index"
          aria-label="Search the index"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.listScroll}>
        {total === 0 ? (
          <p className={styles.listEmpty}>
            {tab === 'needs'
              ? 'Nothing is asking for you right now.'
              : 'Nothing matches that search.'}
          </p>
        ) : (
          <div className={styles.bands}>
            {visibleByBand.map(({ band, rows }) => (
              <Band
                key={band}
                band={band}
                rows={rows}
                selectedId={selectedId}
                onSelect={onSelect}
                destinationFor={destinationFor}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
