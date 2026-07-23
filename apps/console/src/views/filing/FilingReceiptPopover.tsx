'use client';

// SOURCING: @radix-ui/react-popover (focus-managed transient surface).
// F3: every item answers "why is this here" in one tap. This is the one place
// in the Index where a shadow token is legal, because it is the one transient
// surface: named choice 3 of the dimensionality register reserves
// --ij-popover-shadow for popovers and gives resting panels their depth from
// the ladder and their boundaries from seams instead.

import { useCallback, useState, useSyncExternalStore } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { FilingReceipt, IndexCollection } from '@/lib/filing/types';
import { attributionSentence, FILING_LAW, tierLabel } from '@/lib/filing/types';
import { IconInfo } from '@/components/shell/icons';

const LAW_SEEN_KEY = 'commonplace.console.filing.law.v1';

// Every row in the ribbon mounts its own popover, so "seen" has to be shared
// across instances rather than held per component: otherwise dismissing the
// line on one receipt leaves it armed on all the others, and the line that
// promised to appear once appears once per item. The subscriber set is the
// smallest thing that makes one dismissal reach every mounted popover.
const lawSubscribers = new Set<() => void>();

function readLawSeen(): boolean {
  try {
    return window.localStorage.getItem(LAW_SEEN_KEY) === 'seen';
  } catch {
    // A browser that refuses storage gets the line every time rather than
    // never: the line is reassurance, and losing it is the worse failure.
    return false;
  }
}

function markLawSeen() {
  try {
    window.localStorage.setItem(LAW_SEEN_KEY, 'seen');
  } catch {
    // Nothing to persist: the line simply reappears next session.
  }
  for (const notify of lawSubscribers) notify();
}

function subscribeLawSeen(onStoreChange: () => void): () => void {
  lawSubscribers.add(onStoreChange);
  return () => {
    lawSubscribers.delete(onStoreChange);
  };
}

/** The one-line law appears once and is dismissible. It teaches the thing that
 *  makes a wrong file cheap, so it is worth saying, and saying once. */
function useFirstUseLaw(): { readonly show: boolean; readonly dismiss: () => void } {
  const seen = useSyncExternalStore(subscribeLawSeen, readLawSeen, () => true);
  const dismiss = useCallback(() => {
    markLawSeen();
  }, []);
  return { show: !seen, dismiss };
}

export interface FilingReceiptPopoverProps {
  readonly receipt: FilingReceipt;
  readonly collections: readonly IndexCollection[];
  readonly onCorrect: (to: string) => void;
}

function shelfName(collections: readonly IndexCollection[], id: string): string {
  return collections.find((collection) => collection.id === id)?.name ?? id;
}

export function FilingReceiptPopover({
  receipt,
  collections,
  onCorrect,
}: FilingReceiptPopoverProps) {
  const { show: showLaw, dismiss: dismissLaw } = useFirstUseLaw();
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Why is ${receipt.item} here`}
          data-filing-receipt-trigger={receipt.item}
          className="flex h-ij-row w-6 shrink-0 items-center justify-center text-ij-ink-info hover:bg-ij-hover-surface"
        >
          <IconInfo size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="left"
          align="start"
          sideOffset={4}
          data-filing-receipt={receipt.item}
          data-paint-region="filing-receipt"
          // z-50 lifts the popover above the ribbon it is anchored to. Without
          // it the portal lands in the DOM behind the scrolling list and its
          // controls are unclickable, which the e2e caught.
          className="z-50 w-80 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-3 font-ij-ui text-ij-ink"
          style={{ boxShadow: 'var(--ij-popover-shadow)' }}
        >
          <p className="text-ij-ink" data-filing-receipt-sentence>
            {attributionSentence(receipt.attribution)}
          </p>

          <dl className="mt-2 flex flex-col gap-1 text-ij-ink-info">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0">Decided by</dt>
              <dd data-filing-receipt-tier={receipt.tier}>{tierLabel(receipt.tier)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0">Confidence</dt>
              <dd>{Math.round(receipt.confidence * 100)} percent</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0">Filed by</dt>
              <dd className="truncate">{receipt.actor.id ?? receipt.actor.kind}</dd>
            </div>
          </dl>

          {receipt.lowConfidence ? (
            <p className="mt-2 text-ij-warn" data-filing-low-confidence>
              This one was a close call and the second opinion was unavailable.
            </p>
          ) : null}

          {receipt.attribution.kind === 'features' &&
          receipt.attribution.features.length > 0 ? (
            <ul className="mt-2 text-ij-ink-info">
              {receipt.attribution.features.slice(0, 3).map((feature) => (
                <li key={feature.name} className="truncate">
                  {feature.name}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 border-t border-ij-seam pt-2">
            <label
              className="block text-ij-ink-info"
              htmlFor={`refile-${receipt.item}`}
            >
              File this somewhere else
            </label>
            <select
              id={`refile-${receipt.item}`}
              data-filing-receipt-correct={receipt.item}
              value={receipt.destination}
              onChange={(event) => {
                if (event.target.value !== receipt.destination) {
                  onCorrect(event.target.value);
                  setOpen(false);
                }
              }}
              className="mt-1 h-ij-control w-full rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2 text-ij-ink"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {shelfName(collections, collection.id)}
                </option>
              ))}
            </select>
          </div>

          {showLaw ? (
            <div
              className="mt-3 border-t border-ij-seam pt-2 text-ij-ink-info"
              data-filing-law
            >
              <p>{FILING_LAW}</p>
              <button
                type="button"
                onClick={dismissLaw}
                data-filing-law-dismiss
                className="mt-1 text-ij-link hover:underline"
              >
                Got it
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
