import type { ComponentType } from "react";
import type { IndexRow, IndexRowDestination } from "@/lib/commonplace/index-queries";

/* Lenses (v2 composable index). A lens is a pure view over rows the shell has
   already fetched and filtered: it never fetches. The shell owns the query and
   the selection; a lens renders and reports clicks. This is the seam that lets
   the same filed items be seen as a stream, a table, a board, a calendar. */

export interface LensProps {
  readonly rows: readonly IndexRow[];
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly destinationFor: (row: IndexRow) => IndexRowDestination | null;
  /** Refile a row to a destination by id (not by selection). Optional: only
   *  lenses that mutate placement (the Kanban, dragging a card between columns)
   *  use it; read-only lenses ignore it. The shell owns the real edit + the
   *  training signal, exactly as the inspector's Refile does. */
  readonly onRefileRow?: (rowId: string, destinationLabel: string) => void;
}

/** What the bound rows actually carry, so a lens can declare what it needs and
 *  the add-widget picker can hide lenses the data cannot fill (data-driven
 *  availability, decided per widget rather than by a fixed tab bar). */
export interface FieldPresence {
  readonly count: number;
  readonly hasDestination: boolean;
  readonly hasDate: boolean;
  readonly hasStatus: boolean;
  readonly hasTags: boolean;
}

export function fieldPresenceOf(rows: readonly IndexRow[]): FieldPresence {
  return {
    count: rows.length,
    hasDestination: rows.some((r) => r.destination !== null),
    hasDate: rows.some((r) => r.when !== undefined),
    // IndexRow carries no status field yet, so status-only lenses (Kanban) stay
    // unavailable until the substrate adds one. This flips to a real check then.
    hasStatus: false,
    hasTags: rows.some((r) => r.tags.length > 0),
  };
}

export interface LensDef {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  /** Data-driven availability: can this lens render the bound rows? */
  readonly available: (fields: FieldPresence) => boolean;
  readonly component: ComponentType<LensProps>;
}

/** A placed lens. v1 binds every widget to the Index query, so only the lens id
 *  is needed; a per-widget `query` + `config` join this when widgets bind to
 *  independent scopes. */
export interface Widget {
  readonly id: string;
  readonly lensId: string;
}
