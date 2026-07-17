// SOURCING: none; pure hold-to-commit state machine for the D6 press-and-hold Keep.
// The obvious library is xstate (state machines), declined on purpose: this is ONE
// linear three-state machine (idle -> holding -> complete), not a statechart worth a
// runtime interpreter and its dependency weight. Modeling it as a pure reducer that
// emits a commit/cancel effect turns the safety property (an interrupted hold must
// never write) into a unit test instead of a hope about the component.
//
// D6 (HANDOFF-MARGIN-RECALL): press and hold to Keep, with a ring that fills over
// ~450ms; releasing before it fills cancels with no write; completion commits once.

/** How long the Keep ring takes to fill (spec: ~450ms). */
export const KEEP_HOLD_MS = 450;

export type HoldPhase = 'idle' | 'holding' | 'complete';

export interface HoldState {
  phase: HoldPhase;
  /** When the current hold started (ms clock supplied by the caller). */
  startMs: number;
  /** Ring fill in [0, 1]. */
  progress: number;
}

export type HoldEvent =
  | { type: 'press'; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'release'; nowMs: number };

/** The side effect the caller must perform: write the Keep, discard it, or nothing. */
export type HoldEffect = 'commit' | 'cancel' | null;

export const IDLE_HOLD: HoldState = { phase: 'idle', startMs: 0, progress: 0 };

/**
 * Advance the hold machine. `commit` fires exactly once, when the ring reaches full on a
 * tick; `cancel` fires when the pointer releases while still filling (the interrupted
 * hold that must not write). Ticks outside a hold are no-ops, so a stray frame after
 * completion never commits twice. Pure: the clock is passed in, so it is unit-tested.
 */
export function holdReducer(
  state: HoldState,
  event: HoldEvent,
  holdMs: number = KEEP_HOLD_MS,
): { state: HoldState; effect: HoldEffect } {
  switch (event.type) {
    case 'press':
      return { state: { phase: 'holding', startMs: event.nowMs, progress: 0 }, effect: null };

    case 'tick': {
      if (state.phase !== 'holding') return { state, effect: null };
      const span = holdMs > 0 ? holdMs : 1;
      const progress = Math.min(1, Math.max(0, (event.nowMs - state.startMs) / span));
      if (progress >= 1) {
        return { state: { phase: 'complete', startMs: state.startMs, progress: 1 }, effect: 'commit' };
      }
      return { state: { ...state, progress }, effect: null };
    }

    case 'release': {
      if (state.phase === 'holding') return { state: IDLE_HOLD, effect: 'cancel' };
      // Released after the commit already fired (or when idle): reset, no write.
      return { state: IDLE_HOLD, effect: null };
    }
  }
}
