// SOURCING: none. Pure keyboard focus ladder for SPEC-MODEL-CANVAS-RECORDS RT5.
// Soft focus outlines a cell; hard focus enters inline edit. No React imports.

export type FocusMode = 'soft' | 'hard' | 'none';

export interface CellFocus {
  readonly rowId: string;
  readonly fieldKey: string;
  readonly mode: FocusMode;
}

function indexOrNull<T>(items: readonly T[], value: T): number {
  const index = items.indexOf(value);
  return index >= 0 ? index : -1;
}

/** Move soft focus across the row/column grid. Returns null when movement is refused. */
export function moveSoftFocus(
  current: CellFocus | null,
  direction: 'up' | 'down' | 'left' | 'right',
  rowIds: readonly string[],
  fieldKeys: readonly string[],
): CellFocus | null {
  if (rowIds.length === 0 || fieldKeys.length === 0) return null;

  const rowIndex = current ? indexOrNull(rowIds, current.rowId) : 0;
  const fieldIndex = current ? indexOrNull(fieldKeys, current.fieldKey) : 0;
  const startRow = rowIndex >= 0 ? rowIndex : 0;
  const startField = fieldIndex >= 0 ? fieldIndex : 0;

  let nextRow = startRow;
  let nextField = startField;

  switch (direction) {
    case 'up':
      if (startRow <= 0) return null;
      nextRow = startRow - 1;
      break;
    case 'down':
      if (startRow >= rowIds.length - 1) return null;
      nextRow = startRow + 1;
      break;
    case 'left':
      if (startField <= 0) return null;
      nextField = startField - 1;
      break;
    case 'right':
      if (startField >= fieldKeys.length - 1) return null;
      nextField = startField + 1;
      break;
    default:
      return null;
  }

  return {
    rowId: rowIds[nextRow] ?? rowIds[0],
    fieldKey: fieldKeys[nextField] ?? fieldKeys[0],
    mode: 'soft',
  };
}

/** Promote the current cell to hard (inline edit) focus. */
export function enterHardFocus(current: CellFocus): CellFocus {
  return { ...current, mode: 'hard' };
}

/** Hard focus drops to soft; soft focus clears. */
export function exitFocus(current: CellFocus | null): CellFocus | null {
  if (!current) return null;
  if (current.mode === 'hard') {
    return { ...current, mode: 'soft' };
  }
  return null;
}
