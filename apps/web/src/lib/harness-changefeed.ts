// SOURCING: none — pure logic (a browser EventSource subscription wrapped in a
// React effect). No upstream component models a harness memory changefeed hook.
/**
 * Subscribe to the harness Item changefeed and surface memory-relevant deltas
 * (SPEC-HARNESS-MEMORY-PROJECTION D6).
 *
 * The stream is proxied same-origin (/api/theorem/harness/changefeed), which
 * pins the tenant server-side; the browser never sees another tenant's deltas.
 * Events arrive named `item.upserted` / `item.deleted`, each carrying an
 * `ItemDelta`. Upserts are filtered to `source === 'harness:memory'` here;
 * deletes are tombstones (no item) and pass through.
 *
 * A delta is treated as an INVALIDATION, not a patch: the changefeed's
 * `item.id` is the composed graph node id, while the REST listing keys on the
 * document's own `doc_id`, so the two ids do not match. The caller responds by
 * re-reading the authoritative listing (the convergence floor). This is why the
 * changefeed is fail-open: a dropped delta is a stale tree, not a wrong tree,
 * because the mount-time read is authoritative.
 *
 * Live deltas require the deployed harness to have `mcp_enabled`,
 * `THEOREM_ITEM_CHANGEFEED=on`, and `THEOREM_GRAPH_HOOKS=on` (all default off).
 * When the stream cannot be established the hook fails open: no live updates, the
 * listing still converges on mount.
 */
import { useEffect, useRef } from 'react';

export type ItemDelta = {
  change: 'upserted' | 'deleted';
  id: string;
  tenant: string;
  item?: {
    id: string;
    kind: string;
    title: string;
    source: string;
    created_at_ms: number;
    updated_at_ms: number;
    extra: unknown;
  };
};

const CHANGEFEED_PATH = '/api/theorem/harness/changefeed';

export function useHarnessMemoryDeltas(onDelta: (delta: ItemDelta) => void): void {
  const callback = useRef(onDelta);
  useEffect(() => {
    callback.current = onDelta;
  }, [onDelta]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(CHANGEFEED_PATH);

    const handle = (raw: MessageEvent) => {
      let delta: ItemDelta | null = null;
      try {
        delta = JSON.parse(raw.data) as ItemDelta;
      } catch {
        return;
      }
      if (!delta) return;
      // Upserts for non-memory items (tasks, jobs, coordination) do not touch the
      // memory tree; deletes are tombstones without a source, so let them through.
      if (delta.change === 'upserted' && delta.item?.source !== 'harness:memory') return;
      callback.current(delta);
    };

    source.addEventListener('item.upserted', handle as EventListener);
    source.addEventListener('item.deleted', handle as EventListener);
    // Fail open: stop on error rather than hammer a disabled endpoint. The
    // mount-time listing already converged; a reload re-establishes the stream.
    source.onerror = () => source.close();

    return () => source.close();
  }, []);
}
