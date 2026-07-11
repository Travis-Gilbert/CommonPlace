"use client";

import { useRef, useSyncExternalStore } from "react";
import { MemoryBlockHost, type DbHost } from "./MemoryBlockHost";
import type { DbObject, ObjectGraph } from "../database/model";

/** Create a stable host for a graph (one per mounted database). */
export function useDbHost(graph: ObjectGraph): DbHost {
  const ref = useRef<MemoryBlockHost | null>(null);
  if (!ref.current) ref.current = new MemoryBlockHost(graph);
  return ref.current;
}

/** Subscribe to the host's object list; re-renders on any emit that mutates. */
export function useObjects(host: DbHost): readonly DbObject[] {
  return useSyncExternalStore(
    (cb) => host.onChange(cb),
    () => host.list(),
    () => host.list(),
  );
}
