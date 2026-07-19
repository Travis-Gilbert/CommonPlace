// SOURCING: none. Pure logic, no upstream component applies.
// The prepared-pack shape (HANDOFF-CARDS-ACTIONS-MENTIONS K3/K4): staged
// context serializes to the pack with the originating object always first,
// and the pack equals the visible chip set exactly (the named invariant of
// the round; K7's probe asserts it). The delegate wire submits this shape.

import type { StagedContextChip } from './shell-store';

export type ActionDestination = 'for-me' | 'with-me';
export type ActionFollowUp = 'mark-handled' | 'keep-open';

export interface PackContextEntry {
  readonly kind: 'object' | 'selection' | 'file';
  readonly label: string;
  readonly object_id?: string;
  readonly object_type?: string;
  /** The entry's canonical `theorem://` address (DESIGN-THEOREM-URI section
   *  3). An action's context names its objects the way everything else does,
   *  so the receiving agent can resolve a pack entry without being told which
   *  tenant the ids belong to. */
  readonly address?: string;
  readonly text?: string;
}

export interface ActionPack {
  readonly instruction: string;
  readonly destination: ActionDestination;
  readonly follow_up: ActionFollowUp;
  readonly context: readonly PackContextEntry[];
}

function entryFromChip(chip: StagedContextChip): PackContextEntry {
  return {
    kind: chip.kind,
    label: chip.label,
    ...(chip.objectId ? { object_id: chip.objectId } : {}),
    ...(chip.objectType ? { object_type: chip.objectType } : {}),
    ...(chip.address ? { address: chip.address } : {}),
    ...(chip.text ? { text: chip.text } : {}),
  };
}

/** Build the pack from exactly the visible chips: origin chips first (the
 *  originating object leads), then the rest in display order. Nothing is
 *  added, nothing is dropped; there is no invisible context lane. */
export function buildActionPack(
  instruction: string,
  chips: readonly StagedContextChip[],
  destination: ActionDestination,
  followUp: ActionFollowUp,
): ActionPack {
  const origin = chips.filter((chip) => chip.source === 'origin');
  const rest = chips.filter((chip) => chip.source !== 'origin');
  return {
    instruction: instruction.trim(),
    destination,
    follow_up: followUp,
    context: [...origin, ...rest].map(entryFromChip),
  };
}

/** The invariant probe (K7): true when the pack's context is exactly the
 *  visible chip set, order-insensitively for non-origin chips but with the
 *  origin leading. Tests call this; the sheet asserts it before submit. */
export function packEqualsChips(pack: ActionPack, chips: readonly StagedContextChip[]): boolean {
  if (pack.context.length !== chips.length) return false;
  const key = (entry: PackContextEntry) =>
    JSON.stringify([
      entry.kind,
      entry.label,
      entry.object_id ?? null,
      entry.object_type ?? null,
      entry.address ?? null,
      entry.text ?? null,
    ]);
  const packKeys = pack.context.map(key).sort();
  const chipKeys = chips.map((chip) => key(entryFromChip(chip))).sort();
  if (packKeys.some((value, index) => value !== chipKeys[index])) return false;
  const firstOrigin = chips.find((chip) => chip.source === 'origin');
  if (firstOrigin && pack.context.length > 0) {
    return key(pack.context[0]) === key(entryFromChip(firstOrigin));
  }
  return true;
}
