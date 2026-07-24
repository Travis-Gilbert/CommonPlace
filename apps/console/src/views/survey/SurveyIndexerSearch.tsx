// SOURCING: 21st.dev gooey SearchBar (behavior extraction). Restyled to Int UI;
// gooey SVG, particles, rainbow gradients, width expand, and lucide dropped.
// Local suggestions filter the open standing-topic harvest; Enter / Search
// commits a live RustyWeb query projected onto the Indexer board.

'use client';

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { IconSearch } from '@/components/shell/icons';
import { DUR, EASE_OUT, seconds, useMotionDurations } from '@/motion/motion-tokens';
import type { SurveyCapture } from './surveyContract';

export type IndexerSearchSuggestionKind =
  | 'title'
  | 'tag'
  | 'domain'
  | 'entity'
  | 'mention';

export interface IndexerSearchSuggestion {
  readonly id: string;
  readonly value: string;
  readonly kind: IndexerSearchSuggestionKind;
  readonly captureIds: readonly string[];
}

export interface SurveyIndexerSearchProps {
  readonly captures: readonly SurveyCapture[];
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onSelectCapture?: (captureId: string) => void;
  /** Commit the current query to live RustyWeb search (Enter / Search). */
  readonly onLiveSearch?: (query: string) => void;
  readonly searching?: boolean;
  readonly className?: string;
  readonly placeholder?: string;
}

const SUGGESTION_CAP = 10;
const KIND_ORDER: readonly IndexerSearchSuggestionKind[] = [
  'title',
  'tag',
  'entity',
  'mention',
  'domain',
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Empty query returns the full harvest; otherwise substring-match capture fields. */
export function filterSurveyCaptures(
  captures: readonly SurveyCapture[],
  query: string,
): readonly SurveyCapture[] {
  const needle = normalize(query);
  if (!needle) return captures;
  return captures.filter((capture) => {
    if (normalize(capture.title).includes(needle)) return true;
    if (normalize(capture.excerpt).includes(needle)) return true;
    if (normalize(capture.domain).includes(needle)) return true;
    if (capture.tags.some((tag) => normalize(tag).includes(needle))) return true;
    if (capture.entities.some((entity) => normalize(entity).includes(needle))) return true;
    if (capture.mentions.some((mention) => normalize(mention).includes(needle))) return true;
    return false;
  });
}

function pushSuggestion(
  bucket: Map<string, IndexerSearchSuggestion>,
  kind: IndexerSearchSuggestionKind,
  value: string,
  captureId: string,
  needle: string,
): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const key = `${kind}:${normalize(trimmed)}`;
  const lower = normalize(trimmed);
  if (needle && !lower.includes(needle)) return;
  const existing = bucket.get(key);
  if (existing) {
    if (!existing.captureIds.includes(captureId)) {
      bucket.set(key, {
        ...existing,
        captureIds: [...existing.captureIds, captureId],
      });
    }
    return;
  }
  bucket.set(key, {
    id: key,
    value: trimmed,
    kind,
    captureIds: [captureId],
  });
}

export function suggestIndexerCaptures(
  captures: readonly SurveyCapture[],
  query: string,
): readonly IndexerSearchSuggestion[] {
  const needle = normalize(query);
  const bucket = new Map<string, IndexerSearchSuggestion>();
  for (const capture of captures) {
    pushSuggestion(bucket, 'title', capture.title, capture.id, needle);
    pushSuggestion(bucket, 'domain', capture.domain, capture.id, needle);
    for (const tag of capture.tags) pushSuggestion(bucket, 'tag', tag, capture.id, needle);
    for (const entity of capture.entities) {
      pushSuggestion(bucket, 'entity', entity, capture.id, needle);
    }
    for (const mention of capture.mentions) {
      pushSuggestion(bucket, 'mention', mention, capture.id, needle);
    }
  }
  const ranked = [...bucket.values()].sort((left, right) => {
    const leftPrefix = needle && normalize(left.value).startsWith(needle) ? 0 : 1;
    const rightPrefix = needle && normalize(right.value).startsWith(needle) ? 0 : 1;
    if (leftPrefix !== rightPrefix) return leftPrefix - rightPrefix;
    const kindDelta = KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
    if (kindDelta !== 0) return kindDelta;
    return left.value.localeCompare(right.value);
  });
  return ranked.slice(0, SUGGESTION_CAP);
}

export function SurveyIndexerSearch({
  captures,
  query,
  onQueryChange,
  onSelectCapture,
  onLiveSearch,
  searching = false,
  className,
  placeholder = 'Search harvest or the web',
}: SurveyIndexerSearchProps) {
  const durations = useMotionDurations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(
    () => (focused ? suggestIndexerCaptures(captures, query) : []),
    [captures, focused, query],
  );
  const listOpen = focused && normalize(query).length > 0 && !searching;

  const applySuggestion = (suggestion: IndexerSearchSuggestion) => {
    onQueryChange(suggestion.value);
    if (suggestion.captureIds.length === 1 && onSelectCapture) {
      onSelectCapture(suggestion.captureIds[0]!);
    }
    setFocused(false);
    inputRef.current?.blur();
  };

  const commitLiveSearch = () => {
    const needle = query.trim();
    if (!needle || !onLiveSearch) return;
    setFocused(false);
    inputRef.current?.blur();
    onLiveSearch(needle);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (onLiveSearch && query.trim()) {
      commitLiveSearch();
      return;
    }
    const first = suggestions[0];
    if (first) applySuggestion(first);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && onLiveSearch && query.trim() && !(listOpen && suggestions[activeIndex])) {
      // Enter with a query commits live search unless a suggestion is actively chosen.
      return;
    }
    if (!listOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        onQueryChange('');
        setFocused(false);
        inputRef.current?.blur();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === 'Enter' && suggestions[activeIndex] && !onLiveSearch) {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex]!);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={cn('relative min-w-0 flex-1 max-w-md lg:max-w-lg', className)}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'flex h-ij-control items-center gap-2 rounded-ij-arc border bg-ij-editor px-2',
          focused ? 'border-ij-accent' : 'border-ij-control-border',
        )}
        data-indexer-search
      >
        <span className="shrink-0 text-ij-ink-info" aria-hidden>
          <IconSearch size={16} />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label="Search Indexer captures and the web"
          aria-busy={searching || undefined}
          aria-expanded={listOpen}
          aria-controls="indexer-search-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
          disabled={searching}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Allow suggestion click before closing.
            window.setTimeout(() => setFocused(false), DUR.fast);
          }}
          onKeyDown={onKeyDown}
          className="survey-focusable min-w-0 flex-1 bg-transparent text-sm text-ij-ink outline-none placeholder:text-ij-ink-disabled disabled:opacity-60"
        />
        {searching ? (
          <span className="shrink-0 font-ij-mono text-[10px] uppercase tracking-wider text-ij-gold">
            Searching
          </span>
        ) : null}
        {query && !searching ? (
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              inputRef.current?.focus();
            }}
            className="survey-focusable shrink-0 rounded-ij-arc px-2 text-xs text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
          >
            Clear
          </button>
        ) : null}
        {onLiveSearch && query.trim() && !searching ? (
          <button
            type="submit"
            className="survey-focusable shrink-0 rounded-ij-arc px-2 text-xs text-ij-ink hover:bg-ij-hover-surface"
          >
            Search
          </button>
        ) : null}
      </form>

      <AnimatePresence>
        {listOpen ? (
          <motion.div
            id="indexer-search-suggestions"
            role="listbox"
            initial={durations.reduced ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={durations.reduced ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: seconds(durations.fast), ease: EASE_OUT }}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome shadow-none"
          >
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ij-ink-info">No captures match</p>
            ) : (
              <ul className="p-1">
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySuggestion(suggestion)}
                      className={cn(
                        'survey-focusable flex w-full items-center gap-2 rounded-ij-arc px-3 py-2 text-left text-sm text-ij-ink',
                        index === activeIndex ? 'bg-ij-selection' : 'hover:bg-ij-hover-surface',
                      )}
                    >
                      <span className="font-ij-mono text-[10px] uppercase tracking-wider text-ij-gold">
                        {suggestion.kind}
                      </span>
                      <span className="min-w-0 truncate">{suggestion.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
