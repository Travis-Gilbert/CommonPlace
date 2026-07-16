/** Shared props for every database view renderer. Objects arrive already
 *  filtered/sorted for the active saved view; the graph carries the relation +
 *  option catalog for label/column resolution. When `host` is present the views
 *  render editable cells (e.g. the status picker) that commit real mutations
 *  through `host.emit`; without it they render read-only. */
import type { DbObject, ObjectGraph, SavedView } from "./model";
import type { DbHost } from "../host/MemoryBlockHost";

export interface DbViewProps {
  readonly graph: ObjectGraph;
  readonly objects: readonly DbObject[];
  readonly view: SavedView;
  readonly onOpen: (id: string) => void;
  readonly host?: DbHost;
}
