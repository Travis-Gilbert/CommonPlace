'use client';

// SOURCING: none. Ambient thread-runtime flag used by shell chrome. Kept
// outside ThreadView so the chat register can retire without deleting this
// context (SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0 GL8).

import { createContext } from 'react';

export const ThreadRuntimeAvailable = createContext(false);
