'use client';

/**
 * StatusSelectCell: the editable status cell of the database/table UI. It is the
 * selection component (the shadcn-linear-combobox pattern via ui/combobox) wired
 * to a real object-property mutation: options come from the host's live relation
 * option catalog, and picking one commits through `host.emit({kind:"update"})`,
 * which re-resolves the cell and notifies every view. Single-select (status);
 * multi-select tag is a follow-up on a multi-select combobox variant.
 */

import { useMemo } from 'react';
import type { DbHost } from '../host/MemoryBlockHost';
import type { Cell } from './model';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

interface StatusSelectCellProps {
  readonly host: DbHost;
  readonly objectId: string;
  readonly relationKey: string;
  readonly cell?: Cell;
}

export function StatusSelectCell({ host, objectId, relationKey, cell }: StatusSelectCellProps) {
  const options = useMemo<ComboboxOption[]>(
    () =>
      Object.values(host.graph.options)
        .filter((o) => o.relationKey === relationKey)
        .map((o) => ({ value: o.id, label: o.name, color: o.color })),
    [host, relationKey],
  );

  const value = cell?.options?.[0]?.id ?? null;

  const onChange = (next: string | null) => {
    void host.emit({ kind: 'update', id: objectId, patch: { [relationKey]: next ? [next] : [] } });
  };

  // Stop row-open (the tr onClick) from firing when interacting with the picker.
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Combobox options={options} value={value} onChange={onChange} placeholder="Set status" />
    </span>
  );
}
