'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type {
  SearchStackController,
  SearchStackSnapshot,
} from '@commonplace/search-stack';
import {
  consoleSearchController,
  hydrateConsoleSearchPreference,
} from './search-client';

export function useSearchStack(
  controller: SearchStackController = consoleSearchController,
): SearchStackSnapshot {
  useEffect(() => {
    if (controller === consoleSearchController) {
      hydrateConsoleSearchPreference();
    }
  }, [controller]);

  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
