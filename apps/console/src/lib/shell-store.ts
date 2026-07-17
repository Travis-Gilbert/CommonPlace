'use client';

// SOURCING: zustand (ledger row: client state). Ephemeral shell/session state
// only; the durable arrangement lives in the surface object via ConsoleBlockHost.

import { create } from 'zustand';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'identity-refused';

/** The island's four modes (HANDOFF-CONSOLE-ROUND-2 named choice 2). */
export type OmnibarMode = 'ask' | 'command' | 'search' | 'objects';

export interface ShellState {
  /** Omnibar island state: one island, four modes, one engine (R1). */
  omnibarOpen: boolean;
  omnibarMode: OmnibarMode;
  openOmnibar(mode: OmnibarMode): void;
  closeOmnibar(): void;
  /** Command-mode reduced motion preview: overrides the media query when on. */
  reducedMotionPreview: boolean;
  toggleReducedMotionPreview(): void;
  /** Selected record id; opens the inspector tool window (G6). */
  selectedRecordId: string | null;
  selectRecord(id: string | null): void;
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
}

export const useShellStore = create<ShellState>((set) => ({
  omnibarOpen: false,
  omnibarMode: 'ask',
  openOmnibar: (mode) => set({ omnibarOpen: true, omnibarMode: mode }),
  closeOmnibar: () => set({ omnibarOpen: false }),
  reducedMotionPreview: false,
  toggleReducedMotionPreview: () =>
    set((state) => ({ reducedMotionPreview: !state.reducedMotionPreview })),
  selectedRecordId: null,
  selectRecord: (id) => set({ selectedRecordId: id }),
  connection: 'disconnected',
  setConnection: (state) => set({ connection: state }),
  presenceCount: null,
  setPresence: (count) => set({ presenceCount: count }),
  progressLabel: null,
  setProgress: (label) => set({ progressLabel: label }),
  tenant: 'Travis-Gilbert',
}));
