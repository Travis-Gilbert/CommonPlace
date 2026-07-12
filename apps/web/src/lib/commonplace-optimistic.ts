'use client';

/**
 * Optimistic mutation + undo (SPEC-UX-PHYSICS D3: apply locally, network in the
 * background, undo over confirm). Two primitives:
 *
 *   runOptimistic   apply a change locally, commit to the server, and roll back to
 *                   exact prior state if the commit fails. For edits, pins, toggles,
 *                   approvals, and optimistic captures.
 *   undoableDelete  a destructive action with an undo window: the item leaves the UI
 *                   at once and an undo toast appears; if the window passes the server
 *                   delete commits, if the user undoes, prior state is restored exactly
 *                   and the server is never touched. No confirm dialog.
 *
 * Backend note: the crate (crates/commonplace/src/block_view.rs, UX-D3.0) now returns a
 * reversible tombstone inverse for Delete/Unlink. Wiring that inverse through the Django
 * API so undo restores server-side after the window is the named backend follow-up; this
 * module restores from captured client state, which is durable within the window.
 */

import { toast } from 'sonner';

export interface OptimisticOp<Prior> {
  /** Apply the change to local state now and return whatever is needed to undo it. */
  readonly applyLocal: () => Prior;
  /** Restore exact prior state (on commit failure, or on undo). */
  readonly rollback: (prior: Prior) => void;
  /** Persist to the server. Resolve on success, reject to trigger rollback. */
  readonly commit: () => Promise<unknown>;
  /** Optional side effect after a failed commit (for example a toast). */
  readonly onError?: (error: unknown, prior: Prior) => void;
}

/**
 * Apply optimistically, commit, and roll back exactly on failure. Returns true when
 * the commit succeeded. The UI reflects the change in the same frame; the network
 * settles in the background.
 */
export async function runOptimistic<Prior>(op: OptimisticOp<Prior>): Promise<boolean> {
  const prior = op.applyLocal();
  try {
    await op.commit();
    return true;
  } catch (error) {
    op.rollback(prior);
    op.onError?.(error, prior);
    return false;
  }
}

export interface UndoableDeleteOp<Prior> {
  /** Toast copy, for example 'Note deleted'. */
  readonly message: string;
  /** Remove the item locally now and return prior state for restore. */
  readonly applyLocal: () => Prior;
  /** Restore prior state exactly (undo, or a failed server commit). */
  readonly rollback: (prior: Prior) => void;
  /** Server delete (a soft tombstone). Runs only if the window passes without undo. */
  readonly commit: () => Promise<unknown>;
  /** Optional side effect if the server delete fails after the window. */
  readonly onCommitError?: (error: unknown, prior: Prior) => void;
  /** Undo window in ms. */
  readonly undoWindowMs?: number;
}

/**
 * Destructive action with a bounded undo window. The commit is deferred until the
 * window passes, so an undo never touches the server and restores exact prior state.
 * If the deferred commit fails, prior state is restored so the UI and server agree.
 */
export function undoableDelete<Prior>(op: UndoableDeleteOp<Prior>): void {
  const windowMs = op.undoWindowMs ?? 6000;
  const prior = op.applyLocal();
  let undone = false;

  const timer = setTimeout(() => {
    if (undone) return;
    void op.commit().catch((error) => {
      op.rollback(prior);
      op.onCommitError?.(error, prior);
    });
  }, windowMs);

  toast(op.message, {
    duration: windowMs,
    action: {
      label: 'Undo',
      onClick: () => {
        undone = true;
        clearTimeout(timer);
        op.rollback(prior);
      },
    },
  });
}
