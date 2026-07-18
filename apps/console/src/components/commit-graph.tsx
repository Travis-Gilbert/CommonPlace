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

import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { nodeDisabled, type ActionStep, type ProjectedNode } from '@/lib/proactivity/model';
import { setResponseStepsAction } from '@/lib/proactivity/node-actions';
import { KIND_META } from '@/views/proactivity/kinds';
import { useGraphInteraction } from '@/views/proactivity/graph-context';
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

/** The visible step stack: authored steps, or one derived row from the effect so
 *  an unprogrammed action still reads as a single step a person can build on. */
function visibleSteps(node: Response): ActionStep[] {
  if (node.steps && node.steps.length > 0) return [...node.steps];
  return [{ id: `${node.id}-s1`, label: node.effectContract.title }];
}

function containerClass(selected: boolean, degraded: boolean, isJoin: boolean, disabled: boolean): string {
  const border = selected
    ? 'border-ij-accent'
    : degraded
      ? 'border-ij-warn'
      : isJoin
        ? 'border-ij-accent-muted'
        : 'border-ij-seam-raised';
  return `flex h-full w-full flex-col overflow-hidden rounded-ij-arc border ${border} bg-ij-editor px-3 py-1.5 font-ij-ui ${disabled ? 'opacity-45' : ''}`;
}

function KindHeader({ node, isJoin }: { readonly node: ProjectedNode; readonly isJoin: boolean }) {
  const meta = KIND_META[node.kind];
  const author = 'author' in node ? node.author : null;
  return (
    <div className="flex items-center gap-1.5">
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

/** One editable step row on the rail: type the step, commit on blur, remove with
 *  the row control. This is how a person programs the agent action. */
function StepRow({
  step,
  onCommit,
  onRemove,
}: {
  readonly step: ActionStep;
  readonly onCommit: (label: string) => void;
  readonly onRemove: () => void;
}) {
  const [label, setLabel] = useState(step.label);
  return (
    <div className="nodrag nopan group/step flex items-center gap-2">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--ij-accent)' }} aria-hidden="true" />
      <input
        className="min-w-0 flex-1 bg-transparent text-xs text-ij-ink outline-none"
        value={label}
        aria-label="Action step"
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => {
          if (label.trim() && label !== step.label) onCommit(label.trim());
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <button
        type="button"
        aria-label="Remove step"
        className="shrink-0 text-xs text-ij-ink-info opacity-0 group-hover/step:opacity-100 hover:text-ij-error"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        ✕
      </button>
    </div>
  );
}

function ResponseStack({ node, selected }: { readonly node: Response; readonly selected: boolean }) {
  const { edits } = useGraphInteraction();
  const steps = visibleSteps(node);
  const meta = responseMeta(node);
  const disabled = nodeDisabled(node);

  const commitSteps = (next: ActionStep[], label: string) => {
    if (!edits) return;
    void edits.run({
      action: setResponseStepsAction(node.id, next),
      inverse: setResponseStepsAction(node.id, steps),
      label,
    });
  };

  return (
    <div
      data-node={node.id}
      data-node-kind="response"
      aria-label={`Response: ${commitMessage(node)}, ${meta.text}${disabled ? ', disabled' : ''}`}
      className={containerClass(selected, node.degraded.degraded, false, disabled)}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />

      <KindHeader node={node} isJoin={false} />
      <p className={`mb-1 truncate text-xs ${meta.ink}`}>{meta.text}</p>

      <div className="flex flex-col gap-0.5 border-l border-ij-seam-raised pl-2">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            onCommit={(label) =>
              commitSteps(
                steps.map((candidate) => (candidate.id === step.id ? { ...candidate, label } : candidate)),
                'edit step',
              )
            }
            onRemove={() =>
              commitSteps(
                steps.filter((candidate) => candidate.id !== step.id),
                'remove step',
              )
            }
          />
        ))}
      </div>

      <button
        type="button"
        className="nodrag nopan mt-0.5 flex items-center gap-1 self-start text-xs text-ij-ink-info hover:text-ij-ink"
        onClick={(event) => {
          event.stopPropagation();
          commitSteps([...steps, { id: `${node.id}-step-${steps.length + 1}-${steps.length}`, label: 'New step' }], 'add step');
        }}
      >
        <span aria-hidden="true">+</span> Add step
      </button>

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
      className={`${containerClass(selected, degraded, isJoin, disabled)} justify-center gap-1`}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <KindHeader node={node} isJoin={isJoin} />
      <p className="truncate text-sm text-ij-ink">{message}</p>
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
