// SOURCING: none; the D6-1 highlight interaction reducer (HANDOFF-MARGIN-RECALL). Maps hover /
// leave / select onto what a margin note reveals: a preview on hover (desktop), the full
// connection on click or tap (mobile). No upstream library models this; it is product policy,
// hand-written and node-tested (the same shape as hold.ts). Carries no DOM: the mount feeds it
// pointer events and renders the mode it returns.

/** Which highlight is being previewed (hover) and which is expanded to its full connection.
 * They are independent: hovering a second note never closes an expanded one. */
export interface HighlightInteractionState {
  hovered: string | null;
  expanded: string | null;
}

export type HighlightInteractionEvent =
  /** Pointer entered a highlight or its note (desktop preview). */
  | { type: 'hover'; id: string }
  /** Pointer left that highlight. */
  | { type: 'leave'; id: string }
  /** Short click (desktop) or tap (mobile): toggle the full connection (D6-2). */
  | { type: 'select'; id: string }
  /** Close the expanded connection panel. */
  | { type: 'collapse' };

export const IDLE_INTERACTION: HighlightInteractionState = { hovered: null, expanded: null };

/** What a given note should render right now. `expanded` outranks `preview`, so a click that
 * lands on an already-hovered note shows the full connection rather than the preview. */
export type NoteMode = 'idle' | 'preview' | 'expanded';

export function noteMode(state: HighlightInteractionState, id: string): NoteMode {
  if (state.expanded === id) return 'expanded';
  if (state.hovered === id) return 'preview';
  return 'idle';
}

/**
 * Advance the interaction state. Hover previews (D6-1); select toggles the full connection so a
 * second click closes it (D6-2); leave only clears the hover it names, so a stale leave from a
 * note the pointer already left cannot blank the current preview.
 */
export function highlightInteraction(
  state: HighlightInteractionState,
  event: HighlightInteractionEvent,
): HighlightInteractionState {
  switch (event.type) {
    case 'hover':
      return state.hovered === event.id ? state : { ...state, hovered: event.id };
    case 'leave':
      return state.hovered === event.id ? { ...state, hovered: null } : state;
    case 'select':
      return { ...state, expanded: state.expanded === event.id ? null : event.id };
    case 'collapse':
      return state.expanded === null ? state : { ...state, expanded: null };
  }
}
