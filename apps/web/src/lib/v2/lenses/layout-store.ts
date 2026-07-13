import { useSyncExternalStore } from 'react';
import type { Widget } from './types';

/* The index layout: which lens widgets are placed, in order. Persisted per-user
   in localStorage through the same external-store pattern the watch queries use
   (SSR-safe, lint-clean). Pane sizes are handled by react-resizable-panels'
   own autoSaveId; this store owns only the widget set. */

const LAYOUT_KEY = 'v2:index:layout';

/** The default assembly: the triage Stream beside a Table over the same rows.
   First run is never blank, and the Stream lens keeps the daily driver intact. */
const DEFAULT_WIDGETS: readonly Widget[] = [
  { id: 'w-stream', lensId: 'stream' },
  { id: 'w-table', lensId: 'table' },
];

function readLayout(): readonly Widget[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGETS;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WIDGETS;
    const widgets = parsed.filter(
      (w): w is Widget =>
        !!w &&
        typeof (w as Widget).id === 'string' &&
        typeof (w as Widget).lensId === 'string',
    );
    // An empty index is a dead end; fall back to the default assembly.
    return widgets.length > 0 ? widgets : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function writeLayout(widgets: readonly Widget[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(widgets));
  } catch {
    /* storage blocked: the in-memory layout still holds for the session */
  }
}

let snapshot: readonly Widget[] | null = null;
// Monotonic suffix so two adds within the same millisecond cannot collide on id.
let widgetSeq = 0;
const listeners = new Set<() => void>();

function currentLayout(): readonly Widget[] {
  if (snapshot === null) snapshot = readLayout();
  return snapshot;
}

function commit(next: readonly Widget[]): void {
  snapshot = next;
  writeLayout(next);
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Refresh on (re)subscribe: storage may have changed while nothing was mounted.
  snapshot = readLayout();
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAYOUT_KEY) {
      snapshot = readLayout();
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useIndexLayout(): {
  widgets: readonly Widget[];
  addWidget: (lensId: string) => void;
  removeWidget: (id: string) => void;
  setWidgetLens: (id: string, lensId: string) => void;
} {
  const widgets = useSyncExternalStore(subscribe, currentLayout, () => DEFAULT_WIDGETS);

  const addWidget = (lensId: string) => {
    commit([...currentLayout(), { id: `w-${Date.now().toString(36)}-${widgetSeq++}`, lensId }]);
  };
  const removeWidget = (id: string) => {
    const next = currentLayout().filter((w) => w.id !== id);
    // Never leave the index empty.
    commit(next.length > 0 ? next : DEFAULT_WIDGETS);
  };
  const setWidgetLens = (id: string, lensId: string) => {
    commit(currentLayout().map((w) => (w.id === id ? { ...w, lensId } : w)));
  };

  return { widgets, addWidget, removeWidget, setWidgetLens };
}
