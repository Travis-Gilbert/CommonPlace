'use client';

// SOURCING: none. The edit runner for the proactivity surface (PG4): every edit
// is an ObjectAction through host.emit, receipted and reversible. A successful
// edit pushes its inverse onto an undo stack; a refused edit (an over-budget
// action class) surfaces the reason and changes nothing. The local store is
// synchronous and notifies subscribers, so an applied edit re-flows the object
// set immediately (optimistic by construction); undo replays the inverse.

import { useCallback, useState } from 'react';
import type { BlockHost, ObjectAction } from '@commonplace/block-view/types';

export interface EditRun {
  readonly action: ObjectAction;
  /** The inverse edit, pushed to the undo stack when the action applies. */
  readonly inverse?: ObjectAction;
  readonly label: string;
}

interface UndoEntry {
  readonly label: string;
  readonly action: ObjectAction;
}

export interface ProactivityEdits {
  readonly error: string | null;
  readonly canUndo: boolean;
  readonly nextUndoLabel: string | null;
  run(edit: EditRun): Promise<boolean>;
  undo(): Promise<void>;
  clearError(): void;
}

export function useProactivityEdits(host: BlockHost): ProactivityEdits {
  const [error, setError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<readonly UndoEntry[]>([]);

  const run = useCallback(
    async (edit: EditRun): Promise<boolean> => {
      const result = await host.emit(edit.action);
      if (!result.ok) {
        setError(result.error ?? 'The edit was refused.');
        return false;
      }
      setError(null);
      if (edit.inverse) {
        const inverse = edit.inverse;
        setUndoStack((stack) => [...stack, { label: edit.label, action: inverse }]);
      }
      return true;
    },
    [host],
  );

  const undo = useCallback(async (): Promise<void> => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    const result = await host.emit(entry.action);
    if (!result.ok) {
      setError(result.error ?? 'Undo was refused.');
      return;
    }
    setError(null);
    setUndoStack((stack) => stack.slice(0, -1));
  }, [host, undoStack]);

  const clearError = useCallback(() => setError(null), []);

  return {
    error,
    canUndo: undoStack.length > 0,
    nextUndoLabel: undoStack[undoStack.length - 1]?.label ?? null,
    run,
    undo,
    clearError,
  };
}
