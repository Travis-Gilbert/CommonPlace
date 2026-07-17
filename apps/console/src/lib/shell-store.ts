'use client';

// SOURCING: zustand (ledger row: client state). Ephemeral shell/session state
// only; the durable arrangement lives in the surface object via ConsoleBlockHost.

import { create } from 'zustand';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'identity-refused';

export interface ShellState {
  searchOpen: boolean;
  setSearchOpen(open: boolean): void;
  /** Selected record id; opens the inspector tool window (G6). */
  selectedRecordId: string | null;
  selectRecord(id: string | null): void;
  /** Connection state surfaced in the status bar, incl. the named identity-refusal state. */
  connection: ConnectionState;
  setConnection(state: ConnectionState): void;
  /** Presence count shown in the status bar. */
  presenceCount: number;
  /** Indeterminate progress label; null hides the bar. */
  progressLabel: string | null;
  setProgress(label: string | null): void;
  /** Tenant identity shown in the status bar. Slug casing is load-bearing. */
  tenant: string;
}

export const useShellStore = create<ShellState>((set) => ({
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  selectedRecordId: null,
  selectRecord: (id) => set({ selectedRecordId: id }),
  connection: 'disconnected',
  setConnection: (state) => set({ connection: state }),
  presenceCount: 1,
  progressLabel: null,
  setProgress: (label) => set({ progressLabel: label }),
  tenant: 'Travis-Gilbert',
}));
