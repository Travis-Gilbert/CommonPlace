'use client';

// SOURCING: cmdk (predicate selection), register controls for values.
//
// F4: author and edit rules with plain predicates, see the Sieve preview for
// mail rules, and consent to or deny agent proposals.
//
// Consent lives here and nowhere else in the Index. A correction acts once and
// is undoable, so it needs no approval; a rule keeps acting after the moment it
// was made, so it does. That asymmetry is the whole reason this surface has an
// approval affordance while the ribbon does not.

import { useCallback, useState } from 'react';
import { Command } from 'cmdk';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import type { FilingPredicateKind, FilingRule } from '@/lib/filing/types';
import { ViewState } from './ViewStates';
import {
  consentRule,
  deleteRule,
  denyRule,
  putRule,
  useFilingRules,
} from './filing/filing-client';

const PREDICATE_KINDS: ReadonlyArray<{
  readonly kind: FilingPredicateKind;
  readonly label: string;
  readonly hint: string;
}> = [
  { kind: 'sender-entity', label: 'Sender is', hint: 'a resolved entity id' },
  { kind: 'source', label: 'Arrived from', hint: 'save, mail, watched-file, ...' },
  { kind: 'path-prefix', label: 'Path starts with', hint: '/inbox/receipts' },
  { kind: 'mime-class', label: 'Content is', hint: 'text, application, image, ...' },
  { kind: 'subject-contains', label: 'Subject contains', hint: 'a word' },
];

function RuleRow({
  rule,
  onChanged,
}: {
  readonly rule: FilingRule;
  readonly onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const act = useCallback(
    async (run: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await run();
        onChanged();
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const pending = rule.state === 'pending-consent';

  return (
    <li
      data-filing-rule={rule.id}
      data-filing-rule-state={rule.state}
      className="border-b border-ij-seam px-2 py-2 text-ij-ink"
    >
      <div className="flex items-baseline gap-2">
        <span className="truncate">
          {rule.predicates
            .map((predicate) => {
              const kind = PREDICATE_KINDS.find((entry) => entry.kind === predicate.kind);
              return `${kind?.label ?? predicate.kind} ${predicate.value}`;
            })
            .join(', ')}
        </span>
        <span className="shrink-0 text-ij-ink-info">to {rule.destination}</span>
        {rule.urgent ? <span className="shrink-0 text-ij-warn">urgent</span> : null}
      </div>

      {pending ? (
        <div className="mt-1" data-filing-rule-proposal>
          <p className="text-ij-ink-info">
            {rule.proposedBy?.id ?? 'An agent'} proposed this
            {rule.reason ? `: ${rule.reason}` : '.'}
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={busy}
              data-filing-rule-consent={rule.id}
              onClick={() => void act(() => consentRule(rule.id))}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover disabled:text-ij-ink-disabled"
            >
              Consent
            </button>
            <button
              type="button"
              disabled={busy}
              data-filing-rule-deny={rule.id}
              onClick={() => void act(() => denyRule(rule.id))}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-4 text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-disabled"
            >
              Deny
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          data-filing-rule-delete={rule.id}
          onClick={() => void act(() => deleteRule(rule.id))}
          className="mt-1 text-ij-link hover:underline disabled:text-ij-ink-disabled"
        >
          Remove
        </button>
      )}

      {rule.sievePreview ? (
        <details className="mt-1" data-filing-rule-sieve={rule.id}>
          <summary className="cursor-pointer text-ij-ink-info">
            Keeps sorting while the app is closed
          </summary>
          <pre className="mt-1 overflow-x-auto border border-ij-seam bg-ij-chrome p-2 font-ij-mono text-ij-ink-info">
            {rule.sievePreview}
          </pre>
        </details>
      ) : null}
    </li>
  );
}

function Author({ onSaved }: { readonly onSaved: () => void }) {
  const [kind, setKind] = useState<FilingPredicateKind>('subject-contains');
  const [value, setValue] = useState('');
  const [destination, setDestination] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = value.trim().length > 0 && destination.trim().length > 0;

  return (
    <form
      data-filing-rule-author
      className="shrink-0 border-b border-ij-seam bg-ij-chrome p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void putRule({
          predicates: [{ kind, value: value.trim() }],
          destination: destination.trim(),
          urgent,
        })
          .then(() => {
            setValue('');
            setDestination('');
            setUrgent(false);
            onSaved();
          })
          .finally(() => setBusy(false));
      }}
    >
      <Command label="Predicate" className="mb-2">
        <Command.List className="flex flex-wrap gap-1">
          {PREDICATE_KINDS.map((entry) => (
            <Command.Item
              key={entry.kind}
              value={entry.kind}
              onSelect={() => setKind(entry.kind)}
              data-filing-predicate-kind={entry.kind}
              data-filing-predicate-active={kind === entry.kind ? 'true' : undefined}
              className="h-ij-row cursor-pointer rounded-ij-arc border border-ij-control-border px-2 text-ij-ink-info data-[filing-predicate-active=true]:bg-ij-selection data-[filing-predicate-active=true]:text-ij-ink"
            >
              {entry.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>

      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={PREDICATE_KINDS.find((entry) => entry.kind === kind)?.hint}
          aria-label="Predicate value"
          data-filing-rule-value
          className="h-ij-control min-w-40 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
        />
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="file into"
          aria-label="Destination"
          data-filing-rule-destination
          className="h-ij-control min-w-32 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 text-ij-ink"
        />
        <label className="flex h-ij-control items-center gap-1 text-ij-ink-info">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(event) => setUrgent(event.target.checked)}
            data-filing-rule-urgent
          />
          urgent
        </label>
        <button
          type="submit"
          disabled={!ready || busy}
          data-filing-rule-save
          className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover disabled:text-ij-ink-disabled"
        >
          Add rule
        </button>
      </div>
    </form>
  );
}

export function IndexRulesView(_props: ViewRenderProps) {
  const { state, refresh } = useFilingRules();

  if (state.status === 'loading') return <ViewState state="loading" />;
  if (state.status === 'unavailable') {
    return <ViewState state="unavailable" capability={state.capability} />;
  }
  if (state.status === 'error') {
    return <ViewState state="error" errorMessage={state.message} onRetry={refresh} />;
  }

  return (
    <div
      data-filing-rules
      data-paint-region="filing-rules"
      className="flex h-full min-h-0 flex-col bg-ij-editor font-ij-ui"
    >
      <div className="flex h-ij-toolwindow-header shrink-0 items-center border-b border-ij-seam bg-ij-chrome px-2 text-ij-ink">
        Rules
      </div>
      <Author onSaved={refresh} />
      {state.data.rules.length === 0 ? (
        <p className="p-4 text-ij-ink-info" data-filing-rules-empty>
          No rules yet. Filing learns from where you put things, so rules are for
          the cases you would rather state outright.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {state.data.rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}
