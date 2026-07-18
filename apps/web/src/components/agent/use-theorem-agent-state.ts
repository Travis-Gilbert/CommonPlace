// SOURCING: none. A defensive selector over @assistant-ui/react's useAuiState;
// no upstream hook models the not-yet-bound transport state.

'use client';

import { useAuiState } from '@assistant-ui/react';

import type { TheoremAgentState } from '@/server/acp/state';

/* Read a slice of the Theorem agent transport state without throwing while the
 * runtime is not bound yet.
 *
 * The stock useAssistantTransportState asserts that thread.extras carries the
 * transport symbol and THROWS when it does not. The extras only attach after
 * the assistant-transport runtime binds on the client, so the stock hook
 * 500s the page during SSR and crashes the tree during the remount that a
 * mode switch performs (both observed live on /chat). This hook returns
 * undefined for those windows instead; callers render their not-ready state.
 *
 * The selector result must be snapshot-stable (a primitive or a reference held
 * by the state object): React rejects getSnapshot results that change identity
 * on every read.
 */
export function useTheoremAgentState<T>(
  selector: (state: TheoremAgentState) => T,
): T | undefined {
  return useAuiState((s) => {
    const extras = s.thread.extras as { state?: TheoremAgentState } | undefined;
    const state = extras?.state;
    return state === undefined ? undefined : selector(state);
  });
}
