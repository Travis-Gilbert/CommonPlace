'use client';

// SOURCING: @commonplace/block-view/addressing for the grammar, and the shell's
// own DrawerProvider + ObjectDrawer (src/lib/providers/drawer-provider.tsx,
// src/components/commonplace/shared/ObjectDrawer.tsx) as the object surface.
// No second object renderer and no second fetch path: the drawer already reads
// through commonplace-api (fetchObjectDetail -> Theorem `item(id:)`).

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { theoremUri } from '@commonplace/block-view/addressing';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { addressFromRouteParams } from '@/lib/theorem-address-route';

/**
 * Resolve a `theorem://` address into the shell's object surface.
 *
 * The route this renders is where a desktop deep link lands
 * (DESIGN-THEOREM-URI section 3). Resolution is the drawer: `openDrawer(id)`
 * feeds the address's graph id to ObjectDrawer, which fetches it through the
 * existing commonplace-api seam and renders the object with its overview,
 * connections and history. Identity lives in the id, so `kind` is carried for
 * legibility only, exactly as the brief specifies.
 *
 * Refusals are absences with reasons: a malformed address renders its refusal
 * message and code rather than an empty screen or a thrown error.
 */
export default function ObjectAddressView() {
  const params = useSearchParams();
  const { openDrawer } = useDrawer();
  const parsed = addressFromRouteParams(params);
  const id = parsed.ok ? parsed.address.id : null;

  useEffect(() => {
    if (id !== null) openDrawer(id);
  }, [id, openDrawer]);

  if (!parsed.ok) {
    return (
      <div
        style={{
          padding: 'calc(var(--u, 8px) * 4)',
          maxWidth: '62ch',
          lineHeight: 1.6,
          color: 'var(--cp-text)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            marginBottom: 'var(--u, 8px)',
          }}
        >
          This address does not resolve
        </h1>
        <p style={{ color: 'var(--cp-text-muted)' }}>{parsed.refusal.message}</p>
        <p
          style={{
            marginTop: 'var(--u, 8px)',
            color: 'var(--cp-text-faint)',
            fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
            fontSize: '13px',
          }}
        >
          {parsed.refusal.code}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 'calc(var(--u, 8px) * 4)',
        maxWidth: '62ch',
        lineHeight: 1.6,
        color: 'var(--cp-text-muted)',
        fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
        fontSize: '13px',
      }}
    >
      {theoremUri(parsed.address)}
    </div>
  );
}
