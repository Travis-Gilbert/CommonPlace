'use client';

// SOURCING: none. React Flow renders custom nodes deep in its own tree, so the
// edit runner reaches them through context rather than node data (which would
// couple every layout pass to a function identity). A node stacks or edits agent
// steps by running an ObjectAction through the same receipted, reversible edits
// the card and inspector use (named choice 5); there is no second write path.

import { createContext, useContext } from 'react';
import type { CommitView } from './commits';
import type { ProactivityEdits } from './use-edits';

export interface GraphInteraction {
  readonly edits: ProactivityEdits | null;
  /** Open the intent composer prefilled with a hint: a compile-only block add
   *  (a custom or complex condition) is described and compiled, never a blank
   *  hand-written row. */
  readonly onCompile?: (hint: string) => void;
  /** The decompiled commit for every node, indexed by node id. Decompiled once
   *  per graph in the altitude above, so a hundred rows do not each rebuild the
   *  lineage index while React Flow is mid-pass. */
  readonly commits?: ReadonlyMap<string, CommitView>;
  /** The lineage a firing lit: the path from the watch that fired down to what
   *  it did (channel 3). Empty when nothing has fired. */
  readonly lit?: ReadonlySet<string>;
}

const GraphInteractionContext = createContext<GraphInteraction>({ edits: null });

export const GraphInteractionProvider = GraphInteractionContext.Provider;

export function useGraphInteraction(): GraphInteraction {
  return useContext(GraphInteractionContext);
}
