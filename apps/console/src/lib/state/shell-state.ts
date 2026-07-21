'use client';

// SOURCING: jotai (ledger row: client state). Ephemeral shell/session state
// only; the durable arrangement lives in the surface object via ConsoleBlockHost.

import { atom, getDefaultStore } from 'jotai';
import type { ObjectRef } from '@commonplace/block-view/types';
import { addressOf } from '../object-address';
import { createAtomStoreFacade } from './store-facade';

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

export const searchPanelOpenAtom = atom(false);
export const searchFieldModeAtom = atom<SearchFieldMode>('search');
export const reducedMotionPreviewAtom = atom(false);
export const selectedRecordIdAtom = atom<string | null>(null);
export const selectedRecordObjectAtom = atom<ObjectRef | null>(null);
export const contextObjectAtom = atom<ObjectRef | null>(null);
export const selectedTypeHintAtom = atom<string | null>(null);
export const connectionAtom = atom<ConnectionState>('disconnected');
export const presenceCountAtom = atom<number | null>(null);
export const progressLabelAtom = atom<string | null>(null);
export const tenantAtom = atom('Travis-Gilbert');
export const actionSheetOriginAtom = atom<ActionSheetOrigin | null>(null);

const shellSliceAtoms = {
  searchPanelOpen: searchPanelOpenAtom,
  searchFieldMode: searchFieldModeAtom,
  reducedMotionPreview: reducedMotionPreviewAtom,
  selectedRecordId: selectedRecordIdAtom,
  selectedRecordObject: selectedRecordObjectAtom,
  contextObject: contextObjectAtom,
  selectedTypeHint: selectedTypeHintAtom,
  connection: connectionAtom,
  presenceCount: presenceCountAtom,
  progressLabel: progressLabelAtom,
  tenant: tenantAtom,
  actionSheetOrigin: actionSheetOriginAtom,
};

type ShellActions = Pick<
  ShellState,
  | 'openSearchPanel'
  | 'closeSearchPanel'
  | 'toggleReducedMotionPreview'
  | 'selectRecord'
  | 'setConnection'
  | 'setPresence'
  | 'setProgress'
  | 'openActionSheet'
  | 'closeActionSheet'
>;

const shellStore = getDefaultStore();

const shellActions: ShellActions = {
  openSearchPanel: (mode) => {
    shellStore.set(searchPanelOpenAtom, true);
    shellStore.set(searchFieldModeAtom, mode);
  },
  closeSearchPanel: () => shellStore.set(searchPanelOpenAtom, false),
  toggleReducedMotionPreview: () =>
    shellStore.set(reducedMotionPreviewAtom, (value) => !value),
  selectRecord: (id, object = null, typeHint = null) => {
    shellStore.set(selectedRecordIdAtom, id);
    shellStore.set(selectedRecordObjectAtom, object);
    shellStore.set(selectedTypeHintAtom, typeHint);
    shellStore.set(contextObjectAtom, object ?? shellStore.get(contextObjectAtom));
  },
  setConnection: (state) => shellStore.set(connectionAtom, state),
  setPresence: (count) => shellStore.set(presenceCountAtom, count),
  setProgress: (label) => shellStore.set(progressLabelAtom, label),
  openActionSheet: (origin) => shellStore.set(actionSheetOriginAtom, origin),
  closeActionSheet: () => shellStore.set(actionSheetOriginAtom, null),
};

const { useStore: useShellStore } = createAtomStoreFacade<ShellState>(
  shellSliceAtoms,
  shellActions,
);

export { useShellStore };

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
