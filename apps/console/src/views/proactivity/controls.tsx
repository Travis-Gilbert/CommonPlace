'use client';

// SOURCING: none. The shared control atoms for the proactivity surface, styled
// only through --ij-*/--rec-* token utilities (no raw values, no em dashes).
// Disable ships on every node kind (named choice 1). Permission and budget
// render on every response (named choice 7) on the accent grammar: pending
// asks on accent, learned autonomy on gold, over budget on error. Degradation
// names its consequence out loud (named choice 2). The inline editors are the
// safe edit surface (PG4); they are the same controls the sentence tokens and
// the card use, so the altitudes cannot drift.

import type { DisableableNode, EffectContract, JudgmentClass, ProjectedNode, ProjectedResponse } from '@/lib/proactivity/model';
import {
  setActionClassAction,
  setConditionParamsAction,
  setDisabledAction,
  setJudgmentClassAction,
  setWatchSourcesAction,
} from '@/lib/proactivity/node-actions';
import { KIND_META, humanClass, humanLifeKind } from './kinds';
import type { ProactivityEdits } from './use-edits';

type Projected<K extends ProjectedNode['kind']> = Extract<ProjectedNode, { kind: K }>;

const CONTROL = 'h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-xs text-ij-ink font-ij-ui';

export function KindChip({ kind }: { readonly kind: ProjectedNode['kind'] }) {
  const meta = KIND_META[kind];
  return (
    <span className={`inline-flex items-center rounded-ij-arc px-2 py-0 text-xs ${meta.tint} ${meta.ink}`}>
      {meta.label}
    </span>
  );
}

export function AuthorTag({ author }: { readonly author: 'agent' | 'human' }) {
  if (author !== 'human') return null;
  return (
    <span className="inline-flex items-center rounded-ij-arc bg-ij-gold-tint px-2 py-0 text-xs text-ij-gold">
      yours
    </span>
  );
}

/** The disable control on every node kind. Reversible and receipted, never a
 *  delete (named choice 1). */
export function DisableControl({ node, edits }: { readonly node: DisableableNode; readonly edits: ProactivityEdits }) {
  const disabled = node.disabled;
  return (
    <button
      type="button"
      aria-pressed={disabled}
      className={`${CONTROL} hover:bg-ij-hover-surface`}
      onClick={() =>
        void edits.run({
          action: setDisabledAction(node.id, !disabled),
          inverse: setDisabledAction(node.id, disabled),
          label: disabled ? `enable ${node.id}` : `disable ${node.id}`,
        })
      }
    >
      {disabled ? 'Enable' : 'Disable'}
    </button>
  );
}

/** The disabled tag rendered on a node whose own switch is off. */
export function DisabledTag({ disabled }: { readonly disabled: boolean }) {
  if (!disabled) return null;
  return (
    <span className="inline-flex items-center rounded-ij-arc bg-ij-chrome px-2 py-0 text-xs text-ij-ink-disabled">
      disabled
    </span>
  );
}

/** Names the consequence of an upstream disable out loud (named choice 2). */
export function DegradedNote({ node }: { readonly node: ProjectedNode }) {
  if (!node.degraded.degraded) return null;
  return (
    <p className="text-xs text-ij-warn" role="status">
      Degraded: {node.degraded.consequence}
    </p>
  );
}

/** The permission clause on a response (named choice 7). */
export function PermissionBadge({ response }: { readonly response: ProjectedResponse }) {
  if (response.budget.overBudget) {
    return <span className="rounded-ij-arc bg-ij-error-bg px-2 py-0 text-xs text-ij-error">Over budget, not running</span>;
  }
  if (!response.permission.hasGrant) {
    return <span className="rounded-ij-arc bg-ij-chrome px-2 py-0 text-xs text-ij-accent">Will ask you every time</span>;
  }
  const revocable = response.permission.revocable ? ', revocable' : '';
  return (
    <span className="rounded-ij-arc bg-ij-gold-tint px-2 py-0 text-xs text-ij-gold">
      Can act on its own, granted {response.permission.grantedOn}
      {revocable}
    </span>
  );
}

/** The standing spend on a response (named choice 7). */
export function BudgetBadge({ response }: { readonly response: ProjectedResponse }) {
  const { budget } = response;
  const cap = budget.cap === null ? 'no cap' : `of ${budget.cap}`;
  const tone = budget.overBudget ? 'text-ij-error' : 'text-ij-ink-info';
  return (
    <span className={`font-ij-mono text-xs ${tone}`} title={`capability ${response.permission.capabilityClass}`}>
      spend {budget.projectedSpend} {cap}
    </span>
  );
}

const JUDGMENT_CLASSES: readonly JudgmentClass[] = ['interrupt', 'digest', 'silent'];

/** Edit the interruption gate class (PG4). */
export function JudgmentClassEditor({
  judgment,
  edits,
}: {
  readonly judgment: Projected<'judgment'>;
  readonly edits: ProactivityEdits;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-ij-ink-info">
      <span>When it fires</span>
      <select
        className={CONTROL}
        value={judgment.judgmentClass}
        disabled={judgment.disabled}
        onChange={(event) => {
          const next = event.target.value as JudgmentClass;
          void edits.run({
            action: setJudgmentClassAction(judgment.id, next),
            inverse: setJudgmentClassAction(judgment.id, judgment.judgmentClass),
            label: 'change interruption',
          });
        }}
      >
        {JUDGMENT_CLASSES.map((option) => (
          <option key={option} value={option}>
            {humanClass(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Edit one numeric condition parameter of an authored watch (PG4). */
export function NumberParamEditor({
  watch,
  param,
  edits,
}: {
  readonly watch: Projected<'watch'>;
  readonly param: string;
  readonly edits: ProactivityEdits;
}) {
  const current = Number(watch.conditionParams[param] ?? 0);
  return (
    <label className="inline-flex items-center gap-1 text-xs text-ij-ink-info">
      <span>{param}</span>
      <input
        type="number"
        className={`${CONTROL} w-16 font-ij-mono`}
        value={current}
        min={0}
        disabled={watch.disabled}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isNaN(value)) return;
          void edits.run({
            action: setConditionParamsAction(watch.id, { ...watch.conditionParams, [param]: value }),
            inverse: setConditionParamsAction(watch.id, watch.conditionParams),
            label: `change ${param}`,
          });
        }}
      />
    </label>
  );
}

/** Edit which sources a watch reads (PG4). */
export function SourcesEditor({
  watch,
  allSources,
  edits,
}: {
  readonly watch: Projected<'watch'>;
  readonly allSources: readonly Projected<'source'>[];
  readonly edits: ProactivityEdits;
}) {
  const selected = new Set(watch.sourceIds);
  return (
    <fieldset className="flex flex-wrap items-center gap-2 text-xs text-ij-ink-info">
      <legend className="sr-only">Sources this watch reads</legend>
      {allSources.map((source) => {
        const checked = selected.has(source.id);
        return (
          <label key={source.id} className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={checked}
              disabled={watch.disabled}
              onChange={() => {
                const next = checked
                  ? watch.sourceIds.filter((id) => id !== source.id)
                  : [...watch.sourceIds, source.id];
                void edits.run({
                  action: setWatchSourcesAction(watch.id, next),
                  inverse: setWatchSourcesAction(watch.id, watch.sourceIds),
                  label: 'change sources',
                });
              }}
            />
            <span className={source.disabled ? 'text-ij-ink-disabled' : ''}>{humanLifeKind(source.lifeKind)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Edit a response's action class within the classes a contract exists for
 *  (PG4). Selecting a no-grant class is permitted; the store refuses an
 *  over-budget class with the budget named. */
export function ActionClassEditor({
  response,
  contracts,
  edits,
}: {
  readonly response: ProjectedResponse;
  readonly contracts: readonly EffectContract[];
  readonly edits: ProactivityEdits;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-ij-ink-info">
      <span>Then</span>
      <select
        className={CONTROL}
        value={response.actionClass}
        disabled={response.disabled}
        onChange={(event) => {
          const next = event.target.value;
          void edits.run({
            action: setActionClassAction(response.id, next),
            inverse: setActionClassAction(response.id, response.actionClass),
            label: 'change action',
          });
        }}
      >
        {contracts.map((contract) => (
          <option key={contract.id} value={contract.actionClass}>
            {contract.title}
          </option>
        ))}
      </select>
    </label>
  );
}
