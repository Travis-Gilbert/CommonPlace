'use client';

// SOURCING: @commonplace/search-stack. Console binds the CSS-free contract to
// its same-origin BFF. The browser never receives an upstream credential.

import {
  LAMBDA_PREFERENCE_KEY,
  createSearchStackClient,
  createSearchStackController,
} from '@commonplace/search-stack';

export const consoleSearchClient = createSearchStackClient({
  basePath: '/api/search',
});

export const consoleSearchController = createSearchStackController({
  client: consoleSearchClient,
  preferences: {
    // PERSISTENCE-ALLOW: UI preference only. This stores the SERP lambda dial,
    // never a query, result, saved page, session, or other user work.
    read: () => null,
    write: (key, value) => {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    },
  },
});

let hydrated = false;

export function hydrateConsoleSearchPreference(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  // PERSISTENCE-ALLOW: UI preference only. Search state stays memory-only.
  const value = window.localStorage.getItem(LAMBDA_PREFERENCE_KEY);
  if (value != null) consoleSearchController.setLambda(Number(value));
}
