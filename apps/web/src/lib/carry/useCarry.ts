'use client';

import { useCallback, useState } from 'react';

import type { ViewType } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';

import { getBundle } from './bundle-store';
import { CARRY_DESTINATION_LABEL, type CarryDestination, type CarryReceipt } from './carry';
import { compileBundle } from './compile';
import { appendRailEntry } from './session-rail';

/** Each carry destination maps to the product view that hosts it. */
const DESTINATION_VIEW: Record<CarryDestination, ViewType> = {
  write: 'project', // ProjectPagesView (Tiptap write surface)
  build: 'code', // CodeWorkspaceView
  research: 'compose', // compose / search constellation surface
};

function carryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `carry-${crypto.randomUUID()}`;
  return `carry-${Date.now().toString(36)}`;
}

/**
 * The one Carry action (HANDOFF-CARRY D2 to D5). Compiles the session bundle,
 * records the carry event and the destination action on the traveling session
 * rail, and opens the destination view seeded with the carried session id. Each
 * destination view reads `carrySessionId` on mount and seeds itself from the
 * shared bundle store, so the arc reads as one session.
 *
 * Carry performs no unrequested generation (spec, Operational): it only compiles
 * and hands off the cited bundle.
 */
export function useCarry(sessionId: string | null): {
  carry: (destination: CarryDestination) => Promise<CarryReceipt | null>;
  busy: boolean;
} {
  const { launchView } = useLayout();
  const [busy, setBusy] = useState(false);

  const carry = useCallback(
    async (destination: CarryDestination): Promise<CarryReceipt | null> => {
      if (!sessionId) return null;
      setBusy(true);
      try {
        const bundle = await getBundle(sessionId);
        if (!bundle || bundle.items.length === 0) return null;

        const packet = await compileBundle(bundle);
        const label = CARRY_DESTINATION_LABEL[destination];
        const receipt: CarryReceipt = {
          id: carryId(),
          sessionId,
          destination,
          itemCount: bundle.items.length,
          at: Date.now(),
          packet,
        };

        // Record the carry event (expandable to the manifest, C5.2).
        await appendRailEntry(sessionId, {
          kind: 'carry',
          summary: `Carried ${receipt.itemCount} ${receipt.itemCount === 1 ? 'source' : 'sources'} into ${label}`,
          receipt: {
            bundleId: sessionId,
            destination,
            itemCount: receipt.itemCount,
            degraded: packet.degraded,
          },
        });

        // Open the destination, seeded from the carried session id.
        launchView(DESTINATION_VIEW[destination], { carrySessionId: sessionId });

        // Record the destination action so the rail reads pre and post carry.
        await appendRailEntry(sessionId, {
          kind: 'destination',
          summary: `Seeded ${label} from the bundle`,
        });

        return receipt;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, launchView],
  );

  return { carry, busy };
}
