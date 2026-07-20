'use client';

// SOURCING: none. Reads the existing page_identity desktop command; no upstream
// component applies.

/**
 * The stage page's node id for Page-scope find (SPEC F1).
 *
 * A live external page has no workspace object id until it is saved, but it does
 * have a stable identity: the BLAKE3 content hash the margin-recall contract
 * already computes (`page_identity`, MR-D1-4). That hash is what the D2 result
 * cache and the D3 anchor key on, so it is the honest addressable id for the
 * page currently on the stage, and it stays stable across an unchanged revisit.
 *
 * Returns null outside the desktop runtime or before the tab has a page: Page
 * scope is then genuinely empty rather than pointed at a fabricated id.
 */

import { useEffect, useState } from 'react';
import { isTauri, listenDesktopEvent, pageIdentity } from '@/lib/desktop';

export function useStagePageIdentity(tabId: string | null): string | null {
  // The identity is stored WITH the tab it belongs to, so switching tabs cannot
  // hand back the previous page's hash while the new read is in flight, and the
  // "no tab" case is derived rather than written by the effect.
  const [resolved, setResolved] = useState<{ tabId: string; contentHash: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!tabId || !isTauri()) return;
    let live = true;
    const read = () => {
      void pageIdentity(tabId)
        .then((identity) => {
          if (live) setResolved({ tabId, contentHash: identity.contentHash || null });
        })
        .catch(() => {
          if (live) setResolved({ tabId, contentHash: null });
        });
    };
    read();
    // A navigation replaces the page, so the identity has to be re-read.
    let unlisten: (() => void) | null = null;
    void listenDesktopEvent<{ tabId: string }>('cobrowse://navigation', (payload) => {
      if (payload.tabId === tabId) read();
    })
      .then((fn) => {
        if (live) unlisten = fn;
        else fn();
      })
      .catch(() => undefined);
    return () => {
      live = false;
      unlisten?.();
    };
  }, [tabId]);

  return resolved && resolved.tabId === tabId ? resolved.contentHash : null;
}
