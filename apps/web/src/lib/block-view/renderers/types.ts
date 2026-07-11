import type { DbObject, SavedView } from "../database/model";
import type { DbHost } from "../host/MemoryBlockHost";

/** Props every Set-view renderer receives. Objects arrive already filtered/sorted. */
export interface ViewProps {
  readonly objects: readonly DbObject[];
  readonly view: SavedView;
  readonly host: DbHost;
  readonly onOpen: (id: string) => void;
}
