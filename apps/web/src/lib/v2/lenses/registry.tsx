import { Columns3, List, Table } from 'lucide-react';
import { StreamLens } from '@/components/v2/index/lenses/StreamLens';
import { TableLens } from '@/components/v2/index/lenses/TableLens';
import { KanbanLens } from '@/components/v2/index/lenses/KanbanLens';
import type { FieldPresence, LensDef } from './types';

/* The lens registry. Adding a lens here is the whole cost of a new way to see
   the index; the shell and the picker read from this list. Each lens declares
   what data it can render, so the add-widget picker only offers lenses the bound
   rows can fill. */

export const LENSES: readonly LensDef[] = [
  {
    id: 'stream',
    label: 'Stream',
    icon: List,
    available: () => true,
    component: StreamLens,
  },
  {
    id: 'table',
    label: 'Table',
    icon: Table,
    available: (fields) => fields.count > 0,
    component: TableLens,
  },
  {
    // Columns are destinations; dragging a card between them refiles it. Offered
    // only when rows carry destinations, so it never degrades to one column.
    id: 'board',
    label: 'Board',
    icon: Columns3,
    available: (fields) => fields.hasDestination,
    component: KanbanLens,
  },
];

export function getLens(id: string): LensDef | undefined {
  return LENSES.find((lens) => lens.id === id);
}

export function availableLenses(fields: FieldPresence): readonly LensDef[] {
  return LENSES.filter((lens) => lens.available(fields));
}
