/** A stable scalar snapshot for bridging imperative stores into React. */
export function createRevisionStore() {
  let revision = 0;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return revision;
    },
    emit() {
      revision += 1;
      for (const listener of listeners) listener();
    },
  };
}
