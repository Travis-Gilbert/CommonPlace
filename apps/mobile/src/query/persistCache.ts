/**
 * Local-first persistence for the react-query cache (UX-D2.3).
 *
 * @tanstack/react-query-persist-client and @tanstack/query-async-storage-persister
 * are not installed in this app; only @tanstack/react-query itself and
 * @react-native-async-storage/async-storage are (see apps/mobile/package.json).
 * Rather than fabricate imports for missing packages, this module builds on
 * dehydrate/hydrate, the same primitives @tanstack/react-query-persist-client
 * uses under the hood: they are re-exported from @tanstack/react-query itself
 * (@tanstack/react-query re-exports all of @tanstack/query-core, which is
 * where dehydrate/hydrate live), so no new dependency is needed.
 *
 * Flow:
 *  - restoreQueryCache() reads one AsyncStorage snapshot and hydrates the
 *    QueryClient with it. Call this before the app's first paint (while the
 *    splash screen is still up) so a cold launch renders the last-known feed
 *    instead of a blank/loading state; queries then revalidate in the
 *    background per their normal staleTime.
 *  - startPersistingQueryCache() subscribes to the query cache and writes a
 *    debounced snapshot back to AsyncStorage whenever a query settles, so the
 *    cache stays warm for the next cold launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'commonplace:mobile:query-cache:v1';
/** Bump this when the shape of persisted data changes; mismatched snapshots are dropped. */
const BUSTER = 'v1';
/** Snapshots older than this are considered stale and discarded rather than hydrated. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** How long to wait after the last cache change before writing a new snapshot. */
const WRITE_DEBOUNCE_MS = 1_000;

type PersistedCache = {
  buster: string;
  savedAt: number;
  state: DehydratedState;
};

/**
 * Reads the last snapshot from AsyncStorage and hydrates it into the given
 * QueryClient. Resolves once hydration is complete, or immediately if there
 * is nothing usable to restore. Safe to call once, before the app renders.
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const persisted = JSON.parse(raw) as PersistedCache;
    if (persisted.buster !== BUSTER) return;
    if (Date.now() - persisted.savedAt > MAX_AGE_MS) return;
    hydrate(queryClient, persisted.state);
  } catch {
    // Corrupt or unreadable snapshot: start cold rather than throw on launch.
  }
}

/**
 * Subscribes to the query cache and debounce-writes a snapshot to
 * AsyncStorage whenever a query settles (success or error, not on every
 * intermediate "fetching" tick). Returns an unsubscribe function.
 */
export function startPersistingQueryCache(queryClient: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const writeSnapshot = () => {
    const snapshot: PersistedCache = {
      buster: BUSTER,
      savedAt: Date.now(),
      state: dehydrate(queryClient),
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  };

  const scheduleWrite = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(writeSnapshot, WRITE_DEBOUNCE_MS);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') {
      scheduleWrite();
      return;
    }
    // Skip the "fetching" tick; only persist once a query has settled.
    if (event.type === 'updated' && event.query.state.fetchStatus !== 'fetching') {
      scheduleWrite();
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
