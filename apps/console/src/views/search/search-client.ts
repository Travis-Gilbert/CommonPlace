'use client';

// SOURCING: @commonplace/search-stack. Console binds the CSS-free contract to
// its same-origin BFF. The browser never receives an upstream credential.

import {
  LAMBDA_PREFERENCE_KEY,
  createSearchStackClient,
  createSearchStackController,
  type SearchStackController,
} from '@commonplace/search-stack';

export const consoleSearchClient = createSearchStackClient({
  basePath: '/api/search',
});

const consoleControllers = new WeakSet<SearchStackController>();
const hydratedControllers = new WeakSet<SearchStackController>();

export function createConsoleSearchController(): SearchStackController {
  const controller = createSearchStackController({
    client: consoleSearchClient,
    preferences: {
      read: () => null,
      write: (key, value) => {
        if (typeof window === 'undefined') return;
        // persistence-preference: key=commonplace.search.lambda; preference=search breadth; reason=restores the person's lambda dial
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // Preference persistence is best effort.
        }
      },
    },
  });
  consoleControllers.add(controller);
  return controller;
}

export const consoleSearchController = createConsoleSearchController();

export function hydrateConsoleSearchPreference(
  controller: SearchStackController = consoleSearchController,
): void {
  if (
    hydratedControllers.has(controller)
    || !consoleControllers.has(controller)
    || typeof window === 'undefined'
  ) return;
  try {
    // persistence-preference: key=commonplace.search.lambda; preference=search breadth; reason=restores the person's lambda dial
    const value = window.localStorage.getItem(LAMBDA_PREFERENCE_KEY);
    if (value != null) {
      const lambda = Number(value);
      if (Number.isFinite(lambda) && lambda >= 0 && lambda <= 1) {
        controller.setLambda(lambda);
      }
    }
    hydratedControllers.add(controller);
  } catch {
    // A later mount may retry hydration when storage becomes available.
  }
}
