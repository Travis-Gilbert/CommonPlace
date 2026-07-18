'use client';

// SOURCING: jalco-ui CommitGraph (ui.justinlevine.me), structure extraction. The
// jalco component is a vertical git graph whose building block is a stack of
// commit rows on a rail; here that stack is how a person programs an agent
// action. elk and React Flow own the graph layout (see graph-layout.ts,
// GraphCanvas.tsx); a node is a CommitNode. A response is a stack of steps a
// person builds up (add, edit, remove rows) and the node grows taller; every
// other kind is a single commit entry: a domain-tinted rail dot, a ref chip (the
// kind), the statement, and a meta line. Every shadcn token from the original
// maps to an Int UI register token, so it clears the register, contrast, icon,
// and fence gates. Steps are attention and plan only: they run through the same
// receipted, reversible edits and never touch the Grant or the EffectContract.

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeDisabled, type ProjectedNode } from '@/lib/proactivity/model';
import { KIND_META, bodyFontClass } from '@/views/proactivity/kinds';
import { useGraphInteraction } from '@/views/proactivity/graph-context';
import { BlockStack } from '@/views/proactivity/BlockStack';
import type { ProactivityRFNode } from '@/views/proactivity/graph-layout';

type Response = Extract<ProjectedNode, { kind: 'response' }>;

/** The rail dot color per kind: the solid domain accent (the chip carries the
 *  tint), so kind reads by color and by the chip label, never color alone. */
const RAIL: Record<ProjectedNode['kind'], string> = {
  stake: 'var(--ij-graph)',
  source: 'var(--ij-memory)',
  watch: 'var(--ij-agent)',
  judgment: 'var(--ij-room)',
  response: 'var(--ij-accent)',
  assumption: 'var(--ij-ink-info)',
};

function commitMessage(node: ProjectedNode): string {
  switch (node.kind) {
    case 'source':
      return node.label;
    case 'response':
      return node.effectContract.title;
    case 'judgment':
      return node.judgmentClass === 'interrupt'
        ? 'Interrupt me'
        : node.judgmentClass === 'digest'
          ? 'Add to digest'
          : 'Note silently';
    default:
      return node.statement;
  }
}

/** The permission clause a response commits to, in the accent grammar: over
 *  budget is refused (error), a grant is learned (gold), no grant asks each time
 *  (accent). */
function responseMeta(node: Response): { text: string; ink: string } {
  if (node.budget.overBudget) return { text: 'over budget, not running', ink: 'text-ij-error' };
  if (node.permission.hasGrant) return { text: 'can act on its own', ink: 'text-ij-gold' };
  return { text: 'asks you every time', ink: 'text-ij-accent' };
}

function containerClass(selected: boolean, degraded: boolean, isJoin: boolean, disabled: boolean): string {
  const border = selected
    ? 'border-ij-accent'
    : degraded
      ? 'border-ij-warn'
      : isJoin
        ? 'border-ij-accent-muted'
        : 'border-ij-seam-raised';
  return `flex h-full w-full flex-col overflow-hidden rounded-ij-arc border ${border} bg-ij-editor px-3 py-1.5 ${disabled ? 'opacity-45' : ''}`;
}

function KindHeader({ node, isJoin }: { readonly node: ProjectedNode; readonly isJoin: boolean }) {
  const meta = KIND_META[node.kind];
  const author = 'author' in node ? node.author : null;
  return (
    <div className="flex items-center gap-1.5 font-ij-mono">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: RAIL[node.kind] }} aria-hidden="true" />
      <span className={`rounded-ij-arc px-1.5 text-xs font-medium ${meta.tint} ${meta.ink}`}>{meta.label}</span>
      {isJoin ? (
        <span className="rounded-ij-arc bg-ij-chrome px-1.5 text-xs text-ij-ink-info" title="A fact and a stake converge here">
          join
        </span>
      ) : null}
      {author === 'human' ? <span className="ml-auto text-xs text-ij-gold">yours</span> : null}
      {author === 'agent' ? <span className="ml-auto text-xs text-ij-ink-info">agent</span> : null}
    </div>
  );
}

function ResponseStack({ node, selected }: { readonly node: Response; readonly selected: boolean }) {
  const { edits, onCompile } = useGraphInteraction();
  const meta = responseMeta(node);
  const disabled = nodeDisabled(node);

  return (
    <div
      data-node={node.id}
      data-node-kind="response"
      aria-label={`Response: ${commitMessage(node)}, ${meta.text}${disabled ? ', disabled' : ''}`}
      className={`${containerClass(selected, node.degraded.degraded, false, disabled)} ${bodyFontClass(node)}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />

      <KindHeader node={node} isJoin={false} />
      <p className={`mb-1 truncate text-xs ${meta.ink}`}>{meta.text}</p>

      {/* The typed block stack: prepare/verify trunk, any then/else fork, and the
          terminal action (the merge). Editing runs the same receipted, reversible
          edits the inspector and card use, so the altitudes cannot drift. */}
      {edits ? (
        <BlockStack node={node} sources={[]} contracts={[]} edits={edits} dense onCompile={onCompile} />
      ) : null}

      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

function SingleEntry({ node, isJoin, selected }: { readonly node: ProjectedNode; readonly isJoin: boolean; readonly selected: boolean }) {
  const disabled = nodeDisabled(node);
  const degraded = node.degraded.degraded;
  const meta = KIND_META[node.kind];
  const message = commitMessage(node);
  return (
    <div
      data-node={node.id}
      data-node-kind={node.kind}
      aria-label={`${meta.label}: ${message}${disabled ? ', disabled' : ''}${degraded ? `, degraded, ${node.degraded.consequence}` : ''}`}
      className={`${containerClass(selected, degraded, isJoin, disabled)} justify-center gap-1 ${bodyFontClass(node)}`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <KindHeader node={node} isJoin={isJoin} />
      <p className="truncate text-sm text-ij-ink font-cp-title">{message}</p>
      {degraded ? <p className="truncate text-xs text-ij-warn">{node.degraded.consequence}</p> : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

/**
 * A proactivity node. A response is a stack of agent-action steps a person
 * builds up (the git-graph building block); every other kind is a single commit
 * entry. The node is read-and-inspect and stack-to-program: handles are hidden
 * (see app.css), the node is selected to open the inspector, and steps edit
 * inline.
 */
export function CommitNode({ data, selected }: NodeProps<ProactivityRFNode>) {
  const node = data.node;
  if (node.kind === 'response') return <ResponseStack node={node} selected={selected} />;
  return <SingleEntry node={node} isJoin={data.isJoin} selected={selected} />;
}
