/**
 * Carry destinations and the carry receipt (HANDOFF-CARRY D2 to D5).
 *
 * One "Carry" action moves a session's cited bundle into Write, Build, or
 * Research. Each destination opens pre-seeded with the compiled cited packet;
 * the carry event is recorded as a receipt that travels with the session rail
 * (D5). The per-destination seeding lives with each destination surface; this
 * module holds the shared vocabulary and the receipt shape.
 */

import type { CitedPacket } from './compile';

/** The three carry destinations (spec D2/D3/D4). */
export type CarryDestination = 'write' | 'build' | 'research';

export const CARRY_DESTINATIONS: CarryDestination[] = ['write', 'build', 'research'];

export const CARRY_DESTINATION_LABEL: Record<CarryDestination, string> = {
  write: 'Write',
  build: 'Build',
  research: 'Research',
};

/** The receipt a carry produces; expands to the bundle manifest (C5.2). */
export interface CarryReceipt {
  id: string;
  sessionId: string;
  destination: CarryDestination;
  /** Item count carried. */
  itemCount: number;
  at: number;
  /** Where the carry landed (document id, workspace id, or constellation id). */
  targetId?: string;
  /** The compiled packet carried, for the expandable manifest. */
  packet: CitedPacket;
}
