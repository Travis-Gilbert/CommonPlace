// SOURCING: none. Shared constants for the API key administration routes.
//
// This lives beside `route.ts` rather than inside it because the App Router
// validates `route.ts` exports against a fixed allowlist (the HTTP verbs plus
// `dynamic`, `revalidate`, `runtime`, and friends). Any other export fails the
// build with "is not a valid Route export field".

/** Named revocation propagation interval (seconds). D9 account UI surface. */
export const API_KEY_REVOCATION_CACHE_SECS = 60;
