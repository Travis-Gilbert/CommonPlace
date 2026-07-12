/** Shared props for every database view renderer. Objects arrive already
 *  filtered/sorted for the active saved view; the graph carries the relation +
 *  option catalog for label/column resolution. */
import type { DbObject, ObjectGraph, SavedView } from "./model";

export interface DbViewProps {
  readonly graph: ObjectGraph;
  readonly objects: readonly DbObject[];
  readonly view: SavedView;
  readonly onOpen: (id: string) => void;
}
