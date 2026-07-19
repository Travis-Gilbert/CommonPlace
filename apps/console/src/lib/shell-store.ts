'use client';

// SOURCING: zustand (ledger row: client state). Ephemeral shell/session state
// only; the durable arrangement lives in the surface object via ConsoleBlockHost.

import { create } from 'zustand';
import type { ObjectRef } from '@commonplace/block-view/types';
import { addressOf } from './object-address';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'identity-refused';

/** A staged context chip on the action sheet (HANDOFF-CARDS-ACTIONS-MENTIONS
 *  named choice 4): context is never silent; every chip is visible and
 *  removable, and the submitted pack equals this list exactly. */
export interface StagedContextChip {
  readonly id: string;
  readonly kind: 'object' | 'selection' | 'file';
  readonly label: string;
  readonly objectId?: string;
  readonly objectType?: string;
  /** The chip's canonical `theorem://` address (DESIGN-THEOREM-URI section 3).
   *  Object chips carry one so the action pack names context by address rather
   *  than by a bare id whose tenant the reader has to guess. */
  readonly address?: string;
  readonly text?: string;
  readonly source: 'origin' | 'manual' | 'auto';
}

export interface ActionSheetOrigin {
  readonly instruction?: string;
  readonly chips: readonly StagedContextChip[];
}

/** The Search field owns discovery only. Generative input belongs to Composer. */
export type SearchFieldMode = 'command' | 'search' | 'objects';

export interface ShellState {
  searchPanelOpen: boolean;
  searchFieldMode: SearchFieldMode;
  openSearchPanel(mode: SearchFieldMode): void;
  closeSearchPanel(): void;
  /** Command-mode reduced motion preview: overrides the media query when on. */
  reducedMotionPreview: boolean;
  toggleReducedMotionPreview(): void;
  /** Selected record id; opens the inspector tool window (G6). */
  selectedRecordId: string | null;
  /** The selected object when the opener already held it (a table row, a grid
   *  cell); saves the inspector a refetch. Null means fetch by id. */
  selectedRecordObject: ObjectRef | null;
  /** Last concrete object selection. Closing the inspector does not erase the
   *  Context companion's stable selection key. */
  contextObject: ObjectRef | null;
  /** Type hint for cross-kind fetches: a relation chip knows its target kind
   *  (K1 named choice 2) so the inspector can query the right types. */
  selectedTypeHint: string | null;
  selectRecord(id: string | null, object?: ObjectRef | null, typeHint?: string | null): void;
  /** Connection state surfaced in the status bar, incl. the named identity-refusal state. */
  connection: ConnectionState;
  setConnection(state: ConnectionState): void;
  /** Presence count from the harness transport; null renders nothing (the
   *  truthfulness rule: presence appears only when a transport reports it). */
  presenceCount: number | null;
  setPresence(count: number | null): void;
  /** Indeterminate progress label; null hides the bar. */
  progressLabel: string | null;
  setProgress(label: string | null): void;
  /** Tenant identity shown in the status bar. Slug casing is load-bearing. */
  tenant: string;
  /** The action sheet (K3): one sheet, three entries, identical everywhere. */
  actionSheetOrigin: ActionSheetOrigin | null;
  openActionSheet(origin: ActionSheetOrigin): void;
  closeActionSheet(): void;
}

export const useShellStore = create<ShellState>((set) => ({
  searchPanelOpen: false,
  searchFieldMode: 'search',
  openSearchPanel: (mode) => set({ searchPanelOpen: true, searchFieldMode: mode }),
  closeSearchPanel: () => set({ searchPanelOpen: false }),
  reducedMotionPreview: false,
  toggleReducedMotionPreview: () =>
    set((state) => ({ reducedMotionPreview: !state.reducedMotionPreview })),
  selectedRecordId: null,
  selectedRecordObject: null,
  contextObject: null,
  selectedTypeHint: null,
  selectRecord: (id, object = null, typeHint = null) =>
    set((state) => ({
      selectedRecordId: id,
      selectedRecordObject: object,
      selectedTypeHint: typeHint,
      contextObject: object ?? state.contextObject,
    })),
  connection: 'disconnected',
  setConnection: (state) => set({ connection: state }),
  presenceCount: null,
  setPresence: (count) => set({ presenceCount: count }),
  progressLabel: null,
  setProgress: (label) => set({ progressLabel: label }),
  tenant: 'Travis-Gilbert',
  actionSheetOrigin: null,
  openActionSheet: (origin) => set({ actionSheetOrigin: origin }),
  closeActionSheet: () => set({ actionSheetOrigin: null }),
}));

/** The staged chip for an object entry: the originating object rides first in
 *  the pack, so openers build it through this helper for a stable shape. The
 *  tenant comes from the store, never from a second literal, so every chip
 *  addresses its object the way the engine does. */
export function objectChip(
  id: string,
  type: string,
  label: string,
  source: StagedContextChip['source'] = 'origin',
): StagedContextChip {
  return {
    id: `chip-object-${id}`,
    kind: 'object',
    label,
    objectId: id,
    objectType: type,
    address: addressOf(useShellStore.getState().tenant, type, id),
    source,
  };
}
