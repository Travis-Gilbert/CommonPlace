'use client';

// SOURCING: @commonplace/block-view/addressing for the address itself (minted
// by the caller through src/lib/object-address.ts) plus the console's own
// clipboard hook (src/lib/use-copy.ts). No upstream component applies: this is
// one register-styled control, and the ledger's icon row owns its glyphs.
// DESIGN-THEOREM-URI section 3: every object a person can point at carries a
// copy-address affordance, and a refused clipboard says so rather than
// swallowing the click.

import { IconCheck, IconCopy } from './icons';
import { useCopyToClipboard } from '@/lib/use-copy';

export interface CopyAddressButtonProps {
  /** The canonical `theorem://` address of the object this button addresses. */
  readonly address: string;
  /** Human name of the addressed object, for the accessible label. */
  readonly name: string;
  /** Chrome for the mount: the card header passes its action treatment. The
   *  default is the bare icon button the inspector footer wants. */
  readonly className?: string;
}

const BARE =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-ij-arc text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink focus:outline-2 focus:outline-ij-accent';

export function CopyAddressButton({ address, name, className = BARE }: CopyAddressButtonProps) {
  const { state, copy } = useCopyToClipboard();
  return (
    <>
      <button
        type="button"
        data-copy-address
        data-copy-state={state}
        aria-label={`Copy address for ${name}`}
        title={address}
        onClick={(event) => {
          // The affordance is its own action: never let it fall through to a
          // wrapping card cell's select.
          event.stopPropagation();
          copy(address);
        }}
        className={className}
        style={{ transition: 'var(--rec-clickable-transition)' }}
      >
        {state === 'copied' ? <IconCheck size={13} /> : <IconCopy size={13} />}
        <span className="sr-only" aria-live="polite">
          {state === 'copied' ? 'Address copied' : ''}
        </span>
      </button>
      {state === 'unavailable' ? (
        // An absence with a reason: the address stays visible and selectable,
        // and the surface says why the button could not take it.
        <span data-copy-unavailable className="text-ij-error">
          no clipboard here; select the address
        </span>
      ) : null}
    </>
  );
}
