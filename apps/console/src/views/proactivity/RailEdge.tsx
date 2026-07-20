'use client';

// SOURCING: jalco-ui `@jalco/commit-graph` (adopted, components/commit-graph.tsx)
// supplies `railPath`, the exact cubic its own rails are drawn with;
// @xyflow/react supplies the custom-edge contract. This file binds the two, and
// deliberately draws NO path of its own: if the rail language ever changes
// upstream, it changes here in the same commit, because there is one builder.

/**
 * The rail edge (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE P2, named choice 2).
 *
 * Every edge is a rail in the lane color of its target's author, drawn with the
 * adopted commit graph's own bezier, and there are no arrowheads: in a commit
 * graph lineage flows by convention, and an arrowhead would be a second and
 * weaker claim about the same relationship.
 *
 * The `horizontal` axis is why this reads like git rather than like a flowchart
 * of boxes: upstream's graph flows downward with rails as columns, this graph
 * flows left to right with rails as rows, and `railPath` is the same cubic with
 * the flow and cross axes swapped. Two rails arriving at one watch therefore
 * converge exactly the way two branches converge on a merge commit.
 */

import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { railPath } from '@/components/commit-graph';
import type { ProactivityRFEdge } from './graph-layout';

export function RailEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
}: EdgeProps<ProactivityRFEdge>) {
  const path = railPath({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, 'horizontal');
  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      // Rails sit behind the commits they connect, the way a rail passes behind
      // a dot in any git client.
      interactionWidth={0}
      data-edge-kind={data?.kind}
    />
  );
}
