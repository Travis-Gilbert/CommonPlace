'use client';

// SOURCING: jalco-ui `@jalco/commit-graph` (adopted, components/commit-graph.tsx)
// supplies `CommitRow`, `CommitDot`, and `RefBadge`; @xyflow/react supplies the
// node contract. This file is the binding between them: it renders the ADOPTED
// row inside a React Flow node rather than restating the row's markup.

/**
 * A node in the standing program is a commit row
 * (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE P2). The row itself is the adopted
 * component's `CommitRow`, so the graph canvas and the vertical commit graph
 * render the same object; what this file adds is the part React Flow owns:
 * position, selection, handles, and the states the mapping asks a commit to
 * show.
 *
 * The states, and what each one means:
 * - merge: a watch where a source stream and a stake stream both arrive. Two
 *   rails converge into it, which turns the banner sentence ("a watch fires
 *   only where both converge") into a picture instead of a caption.
 * - HEAD: the current tip. What runs.
 * - revert: a disabled node. The undo affordance already on the surface is what
 *   reverses it, so nothing new is written to reach this state.
 * - candidate: uncommitted work ahead of HEAD, dashed, awaiting commit.
 * - lit: this commit is on the lineage a firing just traversed.
 *
 * A response is additionally a stack of typed blocks, because a response is the
 * one kind a person programs by stacking rather than by writing a sentence.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CommitDot, CommitRow, RefBadge, laneColor } from '@/components/commit-graph';
import { nodeDisabled, type ProjectedNode } from '@/lib/proactivity/model';
import { cn } from '@/lib/utils';
import { BlockStack } from './BlockStack';
import { laneOf, mergeWatchIds, permissionClause, shortId, stakeRefIndex, toCommit, type CommitView } from './commits';
import { useGraphInteraction } from './graph-context';
import type { CandidateRFNode, ProactivityRFNode } from './graph-layout';
import { KIND_META } from './kinds';
import { faceClass, speakerOf } from './typography';

type Response = Extract<ProjectedNode, { kind: 'response' }>;

/**
 * The commit frame. A commit row on this canvas is a card-shaped surface
 * because React Flow needs a hit target and the rails arrive at its edges, but
 * the chrome stays out of the way: the border carries state and nothing else
 * does, so the row itself reads exactly as it does in the vertical graph.
 */
function frameClass(facts: CommitView['facts'], selected: boolean, degraded: boolean, disabled: boolean): string {
  return cn(
    'flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-ij-arc border bg-ij-editor px-3 py-1.5',
    facts.isCandidate && 'border-dashed bg-ij-chrome',
    // Selection owns the accent, and nothing else may (named choice 3).
    selected
      ? 'border-ij-accent'
      : degraded
        ? 'border-ij-warn'
        : facts.isMerge
          ? 'border-ij-gold'
          : 'border-ij-seam-raised',
    disabled && 'opacity-45',
  );
}

/** The kind chip, the merge marker, and the decorations: refs (the stake this
 *  lineage protects, HEAD, revert, uncommitted, the spend chip) and the grant
 *  tag. Upstream puts these inline before the message; on a node-sized row that
 *  starves the sentence, so they ride the header and the message keeps its
 *  width. Kind never reads by color alone: the chip carries the label beside
 *  the rail dot's register tint. */
function CommitHeader({ view }: { readonly view: CommitView }) {
  const { node, commit, facts } = view;
  const meta = KIND_META[node.kind];
  const ink = laneColor(facts.lane);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CommitDot lane={facts.lane} lit={facts.isHead} />
      <span
        data-type-role="machine"
        className={cn('rounded-ij-arc px-1.5 font-ij-mono text-xs font-medium', meta.tint, meta.ink)}
      >
        {meta.label}
      </span>
      {facts.isMerge ? <RefBadge label="merge" ink={laneColor('derived')} /> : null}
      {commit.refs?.map((ref) => (
        <RefBadge key={ref} label={ref} ink={ink} dashed={facts.isCandidate} />
      ))}
      {commit.tag ? <RefBadge label={commit.tag} ink={ink} tag dashed={facts.isCandidate} /> : null}
    </div>
  );
}

function CommitBody({ view, selected }: { readonly view: CommitView; readonly selected: boolean }) {
  const { node, commit, facts } = view;
  const { edits, onCompile, lit } = useGraphInteraction();
  const disabled = nodeDisabled(node);
  const isLit = lit?.has(node.id) ?? false;
  const titleClass = faceClass('title', speakerOf('author' in node ? node : undefined));

  return (
    <div
      data-node={node.id}
      data-node-kind={node.kind}
      data-commit-head={facts.isHead || undefined}
      data-commit-merge={facts.isMerge || undefined}
      data-commit-revert={facts.isRevert || undefined}
      data-commit-candidate={facts.isCandidate || undefined}
      data-commit-lit={isLit || undefined}
      data-commit-lane={facts.lane}
      aria-label={`${KIND_META[node.kind].label} commit ${shortId(node.id)}: ${commit.message}${
        disabled ? ', reverted' : ''
      }${facts.isMerge ? ', a merge of a source stream and a stake' : ''}${facts.isHead ? ', the current tip' : ''}`}
      className={cn(frameClass(facts, selected, node.degraded.degraded, disabled), isLit && 'ring-1 ring-ij-gold')}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <CommitHeader view={view} />
      <CommitRow commit={commit} lane={facts.lane} titleClass={titleClass} dashed={facts.isCandidate} showRefs={false} />
      {node.kind === 'response' ? (
        // The permission clause: what this commit is allowed to do, stated on
        // the commit that would do it and nowhere else (named choice 7).
        <p
          className={cn('truncate font-ij-mono text-xs', permissionClause(node).ink)}
          data-type-role="machine"
          data-permission
        >
          {permissionClause(node).text}
        </p>
      ) : null}
      {node.degraded.degraded ? (
        <p
          className={cn('truncate text-xs text-ij-warn', faceClass('body', speakerOf('author' in node ? node : undefined)))}
          data-type-role="body"
          data-type-speaker={speakerOf('author' in node ? node : undefined)}
        >
          {node.degraded.consequence}
        </p>
      ) : null}
      {node.kind === 'response' && edits ? (
        // The typed block stack: prepare/verify trunk, any then/else fork, and
        // the terminal action (the merge). It runs the same receipted,
        // reversible edits the inspector and card use, so the altitudes cannot
        // drift, and it never touches the Grant or the EffectContract.
        <BlockStack node={node as Response} sources={[]} contracts={[]} edits={edits} dense onCompile={onCompile} />
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

/**
 * The React Flow node type. The decompiled commit comes from the altitude above
 * through context (one decompile per graph, not one per node per render); if it
 * is missing, the node decompiles itself so a node can never render blank.
 */
export function CommitNode({ data, selected }: NodeProps<ProactivityRFNode>) {
  const { commits } = useGraphInteraction();
  const node = data.node;
  const view =
    commits?.get(node.id) ??
    toCommit(node, {
      graph: { tenant: '', nodes: [node], edges: [] },
      merges: mergeWatchIds({ tenant: '', nodes: [node], edges: [] }),
      stakeRefs: stakeRefIndex({ tenant: '', nodes: [node], edges: [] }),
    });
  return <CommitBody view={view} selected={selected} />;
}

/**
 * A candidate commit node: PG5 compiler output sitting ahead of HEAD, dashed
 * and uncommitted, exactly the way `git status` shows staged work. It has no
 * projection behind it, so it has no state chrome and no block stack: it is a
 * proposal, and the only two things you can do with it are commit it or discard
 * it, both of which live on the review panel that produced it.
 */
export function CandidateNode({ data }: NodeProps<CandidateRFNode>) {
  return (
    <div
      data-node-kind="candidate"
      data-commit-candidate
      data-commit-lane="human"
      aria-label={`Uncommitted ${data.kindLabel.toLowerCase()}: ${data.commit.message}`}
      className="flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-ij-arc border border-dashed border-cp-human bg-ij-chrome px-3 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <CommitDot lane="human" />
        <span data-type-role="machine" className="rounded-ij-arc bg-ij-chrome px-1.5 font-ij-mono text-xs font-medium text-ij-ink-info">
          {data.kindLabel}
        </span>
      </div>
      <CommitRow commit={data.commit} lane="human" titleClass={faceClass('title', 'human')} dashed showRefs={false} />
    </div>
  );
}

export { laneOf };
