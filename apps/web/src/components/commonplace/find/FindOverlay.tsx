'use client';

// SOURCING: cmdk (Command / Command.Input / Command.List / Command.Item / Command.Empty)
// for the query input and result list, the same binding CommandPalette.tsx uses, with
// shouldFilter={false} because the executor already ranked. @radix-ui/react-toggle-group
// for the lane chips (multiple) and the scope stepper (single), the same binding
// ShelfFilter.tsx uses. lucide-react for the relation glyphs (see RelationGlyph.tsx).

/**
 * Find overlay (SPEC F1): a panel over the loaded page carrying the query input,
 * the lane chips, the scope stepper, and the result rows.
 *
 * It is a panel, not a modal. A Page-scope hit highlights inside the page behind
 * it, so covering that page would hide the very thing selection produces. The
 * five view states resolve through the project's ViewState discipline: no raw
 * spinner, no undesigned empty.
 */

import { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  FIND_SCOPE_ORDER,
  type FindResult,
  type FindScopeKind,
} from '@commonplace/block-view-contracts/search-stack';
import { hasData } from '@/lib/commonplace-view-state';
import {
  LANE_CHIPS,
  LANE_CHIP_LABEL,
  SCOPE_LABEL,
  chipForLane,
  type FindOverlay as FindOverlayState,
  type LaneChip,
} from './useFindOverlay';
import { RelationGlyph, relationLabel } from './RelationGlyph';
import styles from './find.module.css';

export function FindOverlay({ find }: { find: FindOverlayState }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (find.open) inputRef.current?.focus();
  }, [find.open]);

  if (!find.open) return null;

  const currentScopeRank = FIND_SCOPE_ORDER.indexOf(find.scope);

  return (
    <div className={styles.overlay} role="dialog" aria-label="Find">
      <Command shouldFilter={false} label="Find">
        <div className={styles.queryRow}>
          <Command.Input
            ref={inputRef}
            className={styles.queryInput}
            value={find.query}
            onValueChange={find.setQuery}
            placeholder="Find on this page"
            aria-label="Find query"
          />
          <kbd className={styles.escHint}>Esc</kbd>
        </div>

        <div className={styles.controlRow}>
          <span className={styles.controlLabel} id="find-lanes-label">
            Lanes
          </span>
          <ToggleGroup.Root
            type="multiple"
            className={styles.segmented}
            value={find.chips}
            onValueChange={(value: string[]) => {
              // Never let every lane go dark: a find with no lane is not a
              // narrower search, it is a broken one.
              if (value.length > 0) find.setChips(value as LaneChip[]);
            }}
            aria-labelledby="find-lanes-label"
          >
            {LANE_CHIPS.map((chip) => (
              <ToggleGroup.Item key={chip} value={chip} className={styles.segment}>
                {LANE_CHIP_LABEL[chip]}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>

          <span className={styles.controlLabel} id="find-scope-label">
            Scope
          </span>
          <ToggleGroup.Root
            type="single"
            className={styles.segmented}
            value={find.scope}
            onValueChange={(value: string) => {
              if (value) find.setScope(value as FindScopeKind);
            }}
            aria-labelledby="find-scope-label"
          >
            {FIND_SCOPE_ORDER.map((scope, rank) => (
              <ToggleGroup.Item
                key={scope}
                value={scope}
                className={`${styles.segment}${rank > currentScopeRank ? ` ${styles.segmentBeyond}` : ''}`}
              >
                {SCOPE_LABEL[scope]}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>

        <Command.List className={styles.results}>
          <FindResults find={find} />
        </Command.List>
      </Command>
    </div>
  );
}

function FindResults({ find }: { find: FindOverlayState }) {
  const { state } = find;

  if (state.status === 'loading') {
    return <div className={styles.notice}>Searching {SCOPE_LABEL[find.scope].toLowerCase()}...</div>;
  }
  if (state.status === 'error') {
    return (
      <div className={`${styles.notice} ${styles.noticeError}`}>
        Find failed: {state.message}
      </div>
    );
  }
  if (!hasData(state)) {
    return (
      <Command.Empty className={styles.notice}>
        {find.query.trim()
          ? `Nothing at ${SCOPE_LABEL[find.scope]} scope. Press the Find key again to widen.`
          : 'Type to search. Press the Find key again to widen the scope.'}
      </Command.Empty>
    );
  }

  const { results, lanes } = state.data;
  const quiet = lanes.filter((lane) => lane.degradedReason);

  return (
    <>
      {find.selectionError ? (
        <div className={`${styles.notice} ${styles.noticeError}`}>
          {find.selectionError}
        </div>
      ) : null}
      {results.map((result, index) => (
        <FindRow
          key={`${result.hit.doc}-${result.hit.byteRange.start}-${index}`}
          result={result}
          onSelect={() => void find.select(result)}
        />
      ))}
      {quiet.map((lane) => (
        <div key={lane.lane} className={styles.notice}>
          {lane.lane} lane went quiet: {lane.degradedReason}
        </div>
      ))}
    </>
  );
}

function FindRow({ result, onSelect }: { result: FindResult; onSelect: () => void }) {
  const { hit, relation } = result;
  const lane = chipForLane(hit.lane);
  const scope = hit.scope.kind;
  return (
    <Command.Item
      className={styles.row}
      value={`${hit.doc}-${hit.byteRange.start}`}
      onSelect={onSelect}
    >
      <RelationGlyph relation={relation} />
      <span className={styles.rowTitle}>{hit.title || hit.source || hit.doc}</span>
      <span className={styles.badges}>
        <span className={`${styles.badge} ${styles.badgeLane}`}>{LANE_CHIP_LABEL[lane]}</span>
        <span className={styles.badge}>{SCOPE_LABEL[scope]}</span>
        <span className={styles.srOnly}>{relationLabel(relation)}</span>
      </span>
      {hit.snippet ? <span className={styles.rowSnippet}>{hit.snippet}</span> : null}
    </Command.Item>
  );
}
