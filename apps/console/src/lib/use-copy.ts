'use client';

// SOURCING: none. The platform's async Clipboard API is the capability itself;
// no ledger row buys anything over navigator.clipboard.writeText. The shape is
// the useCopyToClipboard hook that already exists in apps/web
// (src/components/assistant-ui/markdown-text.tsx): a copy call plus a state
// that resets itself, so no surface owns a timer. It is re-implemented rather
// than imported because the import fence (scripts/check-import-fence.mjs) makes
// the apps/web boundary structural.

import { useCallback, useEffect, useRef, useState } from 'react';

/** Idle, the copy landed, or this surface has no clipboard to copy into. */
export type CopyState = 'idle' | 'copied' | 'unavailable';

export interface CopyToClipboard {
  readonly state: CopyState;
  /** Copy `value`. Never throws: a refused or absent clipboard settles into
   *  the `unavailable` state so the surface can say so. */
  copy(value: string): void;
}

/** `resetAfterMs` is how long the settled state stays readable. It is a label
 *  lifetime, not motion: nothing animates, so it is not an inventory row. */
export function useCopyToClipboard(resetAfterMs = 2000): CopyToClipboard {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settle = useCallback(
    (next: CopyState) => {
      setState(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), resetAfterMs);
    },
    [resetAfterMs],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    (value: string) => {
      if (!value) return;
      // No clipboard (an insecure origin, an older engine, a locked-down
      // embed) is an absence with a reason, not a swallowed click.
      const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') {
        settle('unavailable');
        return;
      }
      clipboard.writeText(value).then(
        () => settle('copied'),
        () => settle('unavailable'),
      );
    },
    [settle],
  );

  return { state, copy };
}
