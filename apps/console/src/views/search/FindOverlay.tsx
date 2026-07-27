'use client';

// SOURCING: cmdk for ranked keyboard navigation. Search behavior and the
// CSS-free anchoring conversion come from @commonplace/search-stack.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Command } from 'cmdk';
import {
  FIND_SCOPE_ORDER,
  LANE_CHIPS,
  LANE_CHIP_LABEL,
  SCOPE_LABEL,
  asyncState,
  byteRangeToTextTarget,
  chipForLane,
  lanesForChips,
  scopesUpTo,
  widenScope,
  type AsyncState,
  type FindRequest,
  type FindResponse,
  type FindResult,
  type FindScopeKind,
  type LaneChip,
  type SearchStackClient,
  type TextTarget,
} from '@commonplace/search-stack';
import { RelationMark, relationLabel } from './RelationMark';
import { consoleSearchClient } from './search-client';

const FIND_RESULT_LIMIT = 20;
const FIND_LAMBDA = 0.8;
const FIND_DEBOUNCE_MS = 180;

export interface FindOverlayContext {
  readonly pageNodeId?: string | null;
  readonly sessionNodeIds?: readonly string[];
  readonly pageText?: string | null;
  readonly getPageText?: () => string | null;
  readonly onHighlightPageHit?: (
    result: FindResult,
    target: TextTarget,
  ) => Promise<void>;
  readonly onOpenItem?: (result: FindResult) => void;
  readonly onReturnFocus?: () => void;
}

export interface FindOverlayProps extends FindOverlayContext {
  readonly client?: SearchStackClient;
}

export function FindOverlay({
  client = consoleSearchClient,
  pageNodeId,
  sessionNodeIds,
  pageText,
  getPageText,
  onHighlightPageHit,
  onOpenItem,
  onReturnFocus,
}: FindOverlayProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<FindScopeKind>('PAGE');
  const [chips, setChips] = useState<LaneChip[]>([...LANE_CHIPS]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    readonly key: string;
    readonly state: AsyncState<FindResponse>;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openRef.current = open;
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setResult(null);
    setSelectionError(null);
    if (onReturnFocus) onReturnFocus();
    else returnFocusRef.current?.focus();
  }, [onReturnFocus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (openRef.current) {
          setScope((current) => widenScope(current));
          setSelectionError(null);
        } else {
          returnFocusRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          setScope('PAGE');
          setOpen(true);
          setSelectionError(null);
        }
        return;
      }
      if (event.key === 'Escape' && openRef.current) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const scopes = scopesUpTo(scope, { pageNodeId, sessionNodeIds });
  const lanes = lanesForChips(chips);
  const trimmed = query.trim();
  const askable =
    open && trimmed.length > 0 && scopes.length > 0 && lanes.length > 0;
  const askKey = askable
    ? JSON.stringify({ query: trimmed, scopes, lanes })
    : null;
  const state: AsyncState<FindResponse> = !askable
    ? asyncState.empty()
    : result?.key === askKey
      ? result.state
      : asyncState.loading();

  useEffect(() => {
    if (!askKey) return;
    const request = JSON.parse(askKey) as Pick<
      FindRequest,
      'query' | 'scopes' | 'lanes'
    >;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      void client.find({
        ...request,
        k: FIND_RESULT_LIMIT,
        lambda: FIND_LAMBDA,
      }, { signal: abort.signal }).then((response) => {
        if (abort.signal.aborted) return;
        setResult({
          key: askKey,
          state: response.results.length
            ? asyncState.success(response)
            : asyncState.empty(),
        });
      }).catch((error: unknown) => {
        if (abort.signal.aborted) return;
        setResult({
          key: askKey,
          state: asyncState.error(errorMessage(error)),
        });
      });
    }, FIND_DEBOUNCE_MS);
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [askKey, client]);

  const select = useCallback(async (item: FindResult) => {
    setSelectionError(null);
    if (item.hit.scope.kind !== 'PAGE') {
      if (onOpenItem) onOpenItem(item);
      else setSelectionError('No workspace opener is available for this result.');
      return;
    }
    const target = byteRangeToTextTarget(item.hit, {
      documentText: pageText ?? getPageText?.() ?? undefined,
      query,
    });
    if (!target) {
      setSelectionError('Could not derive a text target for this hit.');
      return;
    }
    if (!onHighlightPageHit) {
      onOpenItem?.(item);
      setSelectionError('No active page highlighter is available for this result.');
      return;
    }
    try {
      await onHighlightPageHit(item, target);
    } catch (error) {
      setSelectionError(`Could not highlight the selected passage: ${errorMessage(error)}`);
    }
  }, [
    onHighlightPageHit,
    onOpenItem,
    getPageText,
    pageText,
    query,
  ]);

  if (!open) return null;
  const currentScopeRank = FIND_SCOPE_ORDER.indexOf(scope);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Find"
      className="absolute inset-x-0 top-0 z-40 border-b border-ij-seam-raised bg-ij-chrome p-3 text-ij-ink"
      style={{ boxShadow: 'var(--ij-popover-shadow)' }}
    >
      <Command shouldFilter={false} label="Find" className="grid gap-2">
        <div className="flex items-center gap-2">
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              setSelectionError(null);
            }}
            placeholder="Find on this page"
            aria-label="Find query"
            className="h-ij-control min-w-0 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink outline-none placeholder:text-ij-ink-disabled focus:border-ij-accent"
          />
          <kbd className="font-ij-mono text-ij-ink-info">Esc</kbd>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span id="find-lanes-label" className="font-ij-mono text-ij-island-meta uppercase text-ij-ink-info">
            Lanes
          </span>
          <div
            role="group"
            aria-labelledby="find-lanes-label"
            className="inline-flex overflow-hidden rounded-ij-arc border border-ij-control-border"
          >
            {LANE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-pressed={chips.includes(chip)}
                onClick={() => {
                  const next = chips.includes(chip)
                    ? chips.filter((candidate) => candidate !== chip)
                    : [...chips, chip];
                  if (next.length) setChips(next);
                }}
                className="h-ij-control border-r border-ij-control-border px-3 text-ij-ink-info last:border-r-0 hover:bg-ij-hover-surface aria-pressed:bg-ij-selection aria-pressed:text-ij-ink"
              >
                {LANE_CHIP_LABEL[chip]}
              </button>
            ))}
          </div>

          <span id="find-scope-label" className="ml-2 font-ij-mono text-ij-island-meta uppercase text-ij-ink-info">
            Scope
          </span>
          <div
            role="radiogroup"
            aria-labelledby="find-scope-label"
            className="inline-flex overflow-hidden rounded-ij-arc border border-ij-control-border"
          >
            {FIND_SCOPE_ORDER.map((candidate, rank) => (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={candidate === scope}
                data-beyond={rank > currentScopeRank ? 'true' : undefined}
                onClick={() => {
                  setScope(candidate);
                  setSelectionError(null);
                }}
                className="h-ij-control border-r border-ij-control-border px-3 text-ij-ink-info last:border-r-0 hover:bg-ij-hover-surface aria-checked:bg-ij-selection aria-checked:text-ij-ink data-[beyond=true]:opacity-50"
              >
                {SCOPE_LABEL[candidate]}
              </button>
            ))}
          </div>
        </div>

        <Command.List className="max-h-80 overflow-y-auto border-t border-ij-seam">
          <FindResults
            query={query}
            scope={scope}
            state={state}
            selectionError={selectionError}
            onSelect={select}
          />
        </Command.List>
      </Command>
    </div>
  );
}

function FindResults({
  query,
  scope,
  state,
  selectionError,
  onSelect,
}: {
  readonly query: string;
  readonly scope: FindScopeKind;
  readonly state: AsyncState<FindResponse>;
  readonly selectionError: string | null;
  readonly onSelect: (result: FindResult) => Promise<void>;
}) {
  if (state.status === 'loading') {
    return <p className="p-3 text-ij-ink-info">Searching {SCOPE_LABEL[scope].toLowerCase()}...</p>;
  }
  if (state.status === 'error') {
    return <p role="alert" className="p-3 text-ij-error">Find failed: {state.message}</p>;
  }
  if (state.status === 'empty') {
    return (
      <Command.Empty className="p-3 text-ij-ink-info">
        {query.trim()
          ? `Nothing at ${SCOPE_LABEL[scope]} scope. Press the Find key again to widen.`
          : 'Type to search. Press the Find key again to widen the scope.'}
      </Command.Empty>
    );
  }

  return (
    <>
      {selectionError ? <p role="alert" className="p-2 text-ij-error">{selectionError}</p> : null}
      {state.data.results.map((item, index) => (
        <Command.Item
          key={`${item.hit.doc}-${item.hit.byteRange.start}-${index}`}
          value={`${item.hit.doc}-${item.hit.byteRange.start}`}
          onSelect={() => void onSelect(item)}
          className="flex cursor-default flex-wrap items-center gap-x-2 border-b border-ij-seam px-2 py-2 text-ij-ink aria-selected:bg-ij-selection"
        >
          <RelationMark relation={item.relation} />
          <span className="min-w-0 flex-1 truncate">{item.hit.title ?? item.hit.source ?? item.hit.doc}</span>
          <span className="ml-auto flex gap-1 font-ij-mono text-ij-island-meta uppercase text-ij-ink-info">
            <span className="rounded-ij-arc-underline border border-ij-control-border px-1">
              {LANE_CHIP_LABEL[chipForLane(item.hit.lane)]}
            </span>
            <span className="rounded-ij-arc-underline border border-ij-control-border px-1">
              {SCOPE_LABEL[item.hit.scope.kind]}
            </span>
            <span className="sr-only">{relationLabel(item.relation)}</span>
          </span>
          {item.hit.snippet ? (
            <span className="ml-6 w-full truncate text-ij-ink-info">
              {item.hit.snippet}
            </span>
          ) : null}
        </Command.Item>
      ))}
      {state.data.lanes.filter((lane) => lane.degradedReason).map((lane) => (
        <p key={lane.lane} className="p-2 text-ij-warn">
          {lane.lane} lane went quiet: {lane.degradedReason}
        </p>
      ))}
    </>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
