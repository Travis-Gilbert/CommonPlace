'use client';

// SOURCING: @xyflow/react useConnection — vendor the in-progress connection
// state; the satisfaction dimming is the substrate's (issue 144 B).
//
// While a wire is being dragged, targets that cannot accept it dim. The naive
// way is to push a per-node flag through React state, which re-renders every
// node on drag start. Instead this writes one attribute on the flow root and
// lets CSS do the rest: each node already advertises the families its ports
// accept, so the five family rules in substrate.css resolve the dimming without
// React touching a single node.

import { useEffect } from 'react';
import { useConnection } from '@xyflow/react';
import type { EdgeFamily } from '../kinds/types';

export interface ConnectionSatisfactionProps {
  /**
   * Resolve the shape-class family of the port a drag started from. Returning
   * undefined means "cannot tell", and nothing dims -- an unknown family must
   * not make the whole canvas look invalid.
   */
  readonly familyForHandle: (
    nodeId: string,
    handleId: string | null,
  ) => EdgeFamily | undefined;
}

export function ConnectionSatisfaction({ familyForHandle }: ConnectionSatisfactionProps) {
  const connection = useConnection();
  const inProgress = connection.inProgress;
  const fromNodeId = connection.fromNode?.id ?? null;
  const fromHandleId = connection.fromHandle?.id ?? null;

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.react-flow');
    if (!root) return;
    if (!inProgress || !fromNodeId) {
      root.removeAttribute('data-connecting-family');
      return;
    }
    const family = familyForHandle(fromNodeId, fromHandleId);
    if (family) {
      root.setAttribute('data-connecting-family', family);
    } else {
      root.removeAttribute('data-connecting-family');
    }
    return () => root.removeAttribute('data-connecting-family');
  }, [familyForHandle, fromHandleId, fromNodeId, inProgress]);

  return null;
}
