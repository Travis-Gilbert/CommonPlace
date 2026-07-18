'use client';

// SOURCING: extends the jalco commit-graph rail vocabulary (commit-graph.tsx) to
// the typed node-model. A node is made of typed blocks whose vocabulary is fixed
// by the host kind (the grammar forbids cross-type drops). This renders the
// block stack two ways: dense on the graph node face (a response is inherently a
// stack, so its face shows the typed rails), and full in the inspector (every
// block carries its editor). Editing a block runs the same receipted, reversible
// ObjectAction the card and sentence use, so the altitudes cannot drift. A
// response's then/else steps fork the rail and rejoin at the terminal action
// (the git-graph fork/merge), still, no motion (the register rule). The palette
// offers only the host kind's legal types: the ones that map to a real field add
// a typed block, and the rest compile from intent (never a blank hand-row).

import { useState } from 'react';
import {
  nodeDisabled,
  type ActionStep,
  type EffectContract,
  type ProjectedNode,
  type ProjectedResponse,
} from '@/lib/proactivity/model';
import {
  blocksForNode,
  isCompileOnly,
  legalBlockTypes,
  type PgBlock,
  type PgBlockType,
} from '@/lib/proactivity/blocks';
import { setResponseStepsAction } from '@/lib/proactivity/node-actions';
import { ActionClassEditor, JudgmentClassEditor, NumberParamEditor, SourcesEditor } from './controls';
import type { ProactivityEdits } from './use-edits';

type SourceProjection = Extract<ProjectedNode, { kind: 'source' }>;

const CHIP = 'shrink-0 rounded-ij-arc bg-ij-chrome px-1.5 text-xs font-medium text-ij-ink-info';

/** The type chip and rail dot: kind reads by the chip label and the dot, never
 *  color alone (the join-honesty rule, applied to blocks). */
function BlockMark({ block }: { readonly block: PgBlock }) {
  return (
    <>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: block.rail }} aria-hidden="true" />
      <span className={CHIP}>{block.chip}</span>
    </>
  );
}

/** Whether a legal type is already present as a singleton (a watch's match, a
 *  judgment's policy, a response's terminal action), so the palette does not
 *  offer to add a second one. */
function presentSingleton(kind: ProjectedNode['kind'], type: PgBlockType): boolean {
  if (kind === 'watch') return type === 'match';
  if (kind === 'judgment') return type === 'policy';
  if (kind === 'response') return type === 'action';
  return false;
}

/** The plain-language hint a compile-only add drops into the intent composer, so
 *  arbitrary logic is described and compiled, not hand-written. */
function compileHint(node: ProjectedNode, type: PgBlockType): string {
  const subject = 'statement' in node ? `"${node.statement}"` : 'this';
  switch (type) {
    case 'stopping':
      return `stop ${subject} when `;
    case 'and_or':
      return `also watch ${subject} when `;
    case 'not':
      return `watch ${subject} but not when `;
    case 'threshold':
      return `add a threshold to ${subject}: `;
    case 'custom':
      return `for ${subject}, also `;
    default:
      return `${subject}: `;
  }
}

function stepId(node: ProjectedResponse, type: PgBlockType): string {
  const count = node.steps?.length ?? 0;
  return `${node.id}-b-${type}-${count + 1}`;
}

/** One block row: the mark, then either an inline step editor (a response's
 *  prepare/verify/custom rows), a field editor (threshold, sources, policy,
 *  action class), or a read-only derived label (a watch's match). */
function BlockRow({
  block,
  node,
  sources,
  contracts,
  edits,
  dense,
  onEditStep,
  onRemoveStep,
}: {
  readonly block: PgBlock;
  readonly node: ProjectedNode;
  readonly sources: readonly SourceProjection[];
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
  readonly dense: boolean;
  readonly onEditStep?: (label: string) => void;
  readonly onRemoveStep?: () => void;
}) {
  const isStep = node.kind === 'response' && block.id !== `${node.id}-b-action`;
  const [label, setLabel] = useState(block.label);

  return (
    <div className="nodrag nopan group/block flex items-center gap-1.5">
      <BlockMark block={block} />

      {isStep ? (
        <>
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-ij-ink outline-none"
            value={label}
            aria-label={`${block.chip} step`}
            disabled={nodeDisabled(node)}
            onChange={(event) => setLabel(event.target.value)}
            onBlur={() => {
              if (label.trim() && label !== block.label) onEditStep?.(label.trim());
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <button
            type="button"
            aria-label={`Remove ${block.chip} step`}
            className="shrink-0 text-xs text-ij-ink-info opacity-0 group-hover/block:opacity-100 hover:text-ij-error"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveStep?.();
            }}
          >
            ✕
          </button>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-ij-ink">{block.label}</span>
      )}

      {/* Field editors, inspector only: a compact node face stays a legible
          summary and edits move to the inspector (progressive disclosure). */}
      {!dense && block.editable?.control === 'number' && node.kind === 'watch' ? (
        <NumberParamEditor watch={node} param={block.editable.param} edits={edits} />
      ) : null}
      {!dense && block.editable?.control === 'sources' && node.kind === 'watch' ? (
        <SourcesEditor watch={node} allSources={sources} edits={edits} />
      ) : null}
      {!dense && block.editable?.control === 'judgmentClass' && node.kind === 'judgment' ? (
        <JudgmentClassEditor judgment={node} edits={edits} />
      ) : null}
      {!dense && block.editable?.control === 'actionClass' && node.kind === 'response' ? (
        <ActionClassEditor response={node} contracts={contracts} edits={edits} />
      ) : null}
    </div>
  );
}

/** The block palette: the grammar made visible. It offers only the host kind's
 *  legal types (Hick's law, the constraint teaches the concept). A hand-addable
 *  type adds a typed step; a compile-only type opens the intent composer. */
function BlockPalette({
  node,
  edits,
  onCompile,
  steps,
}: {
  readonly node: ProjectedNode;
  readonly edits: ProactivityEdits;
  readonly onCompile?: (hint: string) => void;
  readonly steps: readonly ActionStep[];
}) {
  const [open, setOpen] = useState(false);
  const types = legalBlockTypes(node.kind).filter((type) => !presentSingleton(node.kind, type));
  if (types.length === 0) return null;

  const addStep = (type: PgBlockType) => {
    if (node.kind !== 'response') return;
    const next: ActionStep[] = [
      ...steps,
      { id: stepId(node, type), label: `New ${type}`, type: type as ActionStep['type'] },
    ];
    void edits.run({
      action: setResponseStepsAction(node.id, next),
      inverse: setResponseStepsAction(node.id, steps),
      label: `add ${type}`,
    });
  };

  return (
    <div className="nodrag nopan relative">
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-ij-ink-info hover:text-ij-ink"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden="true">+</span> block
      </button>
      {open ? (
        <div className="absolute left-0 z-10 mt-1 flex w-52 flex-col rounded-ij-arc border border-ij-control-border bg-ij-raised p-1">
          {types.map((type) => {
            const compile = isCompileOnly(type);
            return (
              <button
                key={type}
                type="button"
                className="flex items-center justify-between gap-2 rounded-ij-arc px-2 py-1 text-left text-xs text-ij-ink hover:bg-ij-hover-surface"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (compile) onCompile?.(compileHint(node, type));
                  else addStep(type);
                }}
              >
                <span>{type}</span>
                <span className="text-ij-ink-info">{compile ? 'from intent' : 'add'}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** A group of branch rows (then/else) rendered on a nested dashed rail, so the
 *  fork reads as a fork in a still image (no motion). */
function BranchGroup({
  branch,
  blocks,
  ...row
}: {
  readonly branch: 'then' | 'else';
  readonly blocks: readonly PgBlock[];
  readonly node: ProjectedNode;
  readonly sources: readonly SourceProjection[];
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
  readonly dense: boolean;
  readonly stepHandlers: (block: PgBlock) => { onEditStep: (label: string) => void; onRemoveStep: () => void };
}) {
  return (
    <div className="ml-2 flex flex-col gap-0.5 border-l border-dashed border-ij-seam-raised pl-2">
      <span className="text-xs uppercase tracking-wide text-ij-ink-info">{branch}</span>
      {blocks.map((block) => (
        <BlockRow key={block.id} block={block} {...row} {...row.stepHandlers(block)} />
      ))}
    </div>
  );
}

/**
 * The typed block stack for one node. On a response it renders the
 * prepare/verify trunk, any then/else fork, the terminal action (the merge), and
 * the palette. On a watch, judgment, or stake it renders the field blocks and
 * the palette (inspector only). Source and assumption have no blocks.
 */
export function BlockStack({
  node,
  sources,
  contracts,
  edits,
  dense = false,
  onCompile,
}: {
  readonly node: ProjectedNode;
  readonly sources: readonly SourceProjection[];
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
  readonly dense?: boolean;
  readonly onCompile?: (hint: string) => void;
}) {
  const blocks = blocksForNode(node);
  const steps: readonly ActionStep[] = node.kind === 'response' ? node.steps ?? [] : [];

  const commitSteps = (next: ActionStep[], label: string) => {
    void edits.run({
      action: setResponseStepsAction(node.id, next),
      inverse: setResponseStepsAction(node.id, steps),
      label,
    });
  };
  const stepHandlers = (block: PgBlock) => ({
    onEditStep: (label: string) =>
      commitSteps(
        steps.map((step) => (step.id === block.id ? { ...step, label } : step)),
        'edit step',
      ),
    onRemoveStep: () => commitSteps(steps.filter((step) => step.id !== block.id), 'remove step'),
  });

  const row = { node, sources, contracts, edits, dense };

  // Response: trunk, fork (then/else), merge (the terminal action).
  if (node.kind === 'response') {
    const terminalId = `${node.id}-b-action`;
    const terminal = blocks.find((block) => block.id === terminalId);
    const stepBlocks = blocks.filter((block) => block.id !== terminalId);
    const trunk = stepBlocks.filter((block) => !block.branch);
    const thenBranch = stepBlocks.filter((block) => block.branch === 'then');
    const elseBranch = stepBlocks.filter((block) => block.branch === 'else');
    const forked = thenBranch.length > 0 || elseBranch.length > 0;

    return (
      <div className="flex flex-col gap-0.5 border-l border-ij-seam-raised pl-2">
        {trunk.map((block) => (
          <BlockRow key={block.id} block={block} {...row} {...stepHandlers(block)} />
        ))}

        {forked ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ij-ink-info">if</span>
            {thenBranch.length > 0 ? (
              <BranchGroup branch="then" blocks={thenBranch} {...row} stepHandlers={stepHandlers} />
            ) : null}
            {elseBranch.length > 0 ? (
              <BranchGroup branch="else" blocks={elseBranch} {...row} stepHandlers={stepHandlers} />
            ) : null}
          </div>
        ) : null}

        {terminal ? (
          <div className={forked ? 'border-t border-ij-seam-raised pt-0.5' : undefined}>
            <BlockRow block={terminal} {...row} />
          </div>
        ) : null}

        <BlockPalette node={node} edits={edits} onCompile={onCompile} steps={steps} />
      </div>
    );
  }

  // Watch, judgment, stake: field blocks plus the palette (inspector).
  return (
    <div className="flex flex-col gap-1 border-l border-ij-seam-raised pl-2">
      {blocks.map((block) => (
        <BlockRow key={block.id} block={block} {...row} />
      ))}
      {blocks.length === 0 ? (
        <span className="text-xs text-ij-ink-info">No blocks yet. Add one from intent.</span>
      ) : null}
      <BlockPalette node={node} edits={edits} onCompile={onCompile} steps={steps} />
    </div>
  );
}
