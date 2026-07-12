'use client';

import { useCallback, useState } from 'react';

import type { ViewType } from '@/lib/commonplace';
import type { PaneNode } from '@/lib/commonplace-layout';
import { useLayout } from '@/lib/providers/layout-provider';

import { getBundle, linkAncestor } from './bundle-store';
import { CARRY_DESTINATION_LABEL, type CarryDestination, type CarryReceipt } from './carry';
import { compileBundle } from './compile';
import { deriveResearchQuery } from './seed-research';
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

/** Find the slug of an open `project` pane, so Carry to Write seeds into the
 *  project the user already has open. Returns null when none is open. */
function openProjectSlug(node: PaneNode): string | null {
  if (node.type === 'leaf') {
    if (node.viewId === 'project') {
      const slug = node.context?.slug;
      if (typeof slug === 'string' && slug) return slug;
    }
    return null;
  }
  return openProjectSlug(node.first) ?? openProjectSlug(node.second);
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
  const { launchView, layout } = useLayout();
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

        // Open the destination, seeded from the carried session id. Write seeds
        // into the project the user has open; each destination view records its
        // own real seed on the rail (with the concrete target id).
        const context: Record<string, unknown> = { carrySessionId: sessionId };
        if (destination === 'write') {
          const slug = openProjectSlug(layout);
          if (slug) context.slug = slug;
        } else if (destination === 'research') {
          // Seed a new research session from the bundle's entities and open
          // questions (C4.1). The new session accumulates its own bundle (C4.3),
          // linked both ways to the carried one (C4.2).
          const researchSession = `research-${carryId()}`;
          await linkAncestor(researchSession, sessionId);
          context.prefillText = deriveResearchQuery(packet);
          context.carrySessionId = researchSession;
          context.ancestorSessionId = sessionId;
          await appendRailEntry(sessionId, {
            kind: 'destination',
            summary: `Seeded Research from ${receipt.itemCount} ${receipt.itemCount === 1 ? 'source' : 'sources'}`,
            receipt: {
              researchSession,
              ancestorSessionId: sessionId,
              query: context.prefillText,
            },
          });
        }
        launchView(DESTINATION_VIEW[destination], context);

        return receipt;
      } finally {
        setBusy(false);
      }
    },
    [sessionId, launchView, layout],
  );

  return { carry, busy };
}
