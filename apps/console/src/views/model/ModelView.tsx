'use client';

// SOURCING: @commonplace/block-view for scope and mutation seams,
// @xyflow/react and tablecn structure through the registered lens components.

import { useEffect, useReducer, useState, type FormEvent } from 'react';
import type { JsonValue, ViewRenderProps } from '@commonplace/block-view/types';
import {
  emptyObservedModel,
  type DeclaredModel,
  type ObservedEdge,
  type ObservedField,
  type PinKind,
  type SchemaProposalDraft,
  type ScopeRef,
} from '@commonplace/data-model-contracts';
import {
  fetchObservedModel,
  postPin,
  postSchemaProposal,
  postUnpin,
} from '@/lib/observed-model-client';
import { MODEL_VIEW_INSTANCE_ID } from '@/lib/workspace-seed';
import { WhyTrace } from '../harness-ux/WhyTracePanel';
import {
  DiagramLens,
  FieldsTableLens,
  RecordsPreviewLens,
} from './ObservedDeclaredLenses';
import {
  createModelQueryState,
  modelScopeFromSet,
  reduceModelQuery,
  type ModelLens,
  type ModelSelection,
} from './modelQuery';

function emptyDeclaredModel(scope: ScopeRef): DeclaredModel {
  return {
    scope,
    objectTypes: [],
    fields: [],
    relations: [],
    views: [],
    versions: [],
  };
}

function selectedObservedEvidence(
  selection: ModelSelection | null,
  observed: ReturnType<typeof emptyObservedModel>,
): ObservedField | ObservedEdge | null {
  if (selection?.kind === 'observed-field') {
    return observed.types.flatMap((type) => type.fields)
      .find((field) => field.observedKey === selection.key) ?? null;
  }
  if (selection?.kind === 'observed-edge') {
    return observed.types.flatMap((type) => type.edges)
      .find((edge) => edge.observedKey === selection.key) ?? null;
  }
  return null;
}

function ProposalCard({
  draft,
  busy,
  onAccept,
  onDecline,
}: {
  readonly draft: SchemaProposalDraft;
  readonly busy: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}) {
  return (
    <section className="border-b border-ij-seam bg-ij-warn-bg px-4 py-3 text-ij-ink" aria-labelledby="schema-proposal-heading">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-ij-mono text-xs text-ij-warn">Schema proposal draft</p>
          <h2 id="schema-proposal-heading" className="mt-1" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {draft.request}
          </h2>
          <p className="mt-2 text-ij-ink-info">{draft.validationSummary}</p>
          <p className="mt-1 text-ij-ink-info">{draft.impactSummary}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {draft.proposedPins.map((pin) => (
              <li key={`${pin.kind}:${pin.observedKey}`} className="rounded-ij-arc-underline bg-ij-raised px-2 py-1 font-ij-mono text-xs">
                {pin.kind}: {pin.observedKey}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy || draft.proposedPins.length === 0}
            onClick={onAccept}
            className="h-ij-control rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    </section>
  );
}

function ModelInspector({
  selection,
  observed,
  declared,
}: {
  readonly selection: ModelSelection | null;
  readonly observed: ReturnType<typeof emptyObservedModel>;
  readonly declared: DeclaredModel;
}) {
  const evidence = selectedObservedEvidence(selection, observed);
  const declaredField = selection?.kind === 'declared-field'
    ? declared.fields.find((field) => field.id === selection.key) ?? null
    : null;
  const observedOrigin = declaredField?.provenance
    ? observed.types.flatMap((type) => type.fields)
        .find((field) => field.observedKey === declaredField.provenance?.observedKey)
    : null;
  const whyNodeId = declaredField?.provenance?.nodeId
    ?? observedOrigin?.provenanceNodeId
    ?? observedOrigin?.eventIds?.[0];
  const evidenceSources = evidence?.sourceRefs?.length
    ? evidence.sourceRefs
    : observed.sources;

  return (
    <aside className="w-full shrink-0 overflow-auto border-t border-ij-seam bg-ij-chrome xl:w-rec-side-panel xl:border-l xl:border-t-0" aria-label="Model inspector">
      <header className="flex h-ij-toolbar items-center border-b border-ij-seam px-3">
        <h2 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Inspector</h2>
      </header>
      {!selection ? (
        <p className="p-4 text-ij-ink-info">Select an observed or declared model element.</p>
      ) : evidence ? (
        <div className="p-4">
          <p className="font-ij-mono text-xs text-ij-ink-info">{selection.kind}</p>
          <h3 className="mt-1 font-ij-mono text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
            {selection.key}
          </h3>
          <section className="mt-5 border-t border-ij-seam pt-4">
            <h4 className="text-xs uppercase tracking-wider text-ij-ink-info">Ingest events</h4>
            {evidence.eventIds?.length ? (
              <ul className="mt-2 grid gap-1 font-ij-mono text-xs">
                {evidence.eventIds.map((id) => <li key={id}>{id}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-ij-ink-info">No ingest events recorded.</p>
            )}
          </section>
          <section className="mt-5 border-t border-ij-seam pt-4">
            <h4 className="text-xs uppercase tracking-wider text-ij-ink-info">Sources</h4>
            {evidenceSources.length ? (
              <ul className="mt-2 grid gap-1 font-ij-mono text-xs">
                {evidenceSources.map((source) => <li key={source}>{source}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-ij-ink-info">No source references recorded.</p>
            )}
          </section>
          <section className="mt-5 border-t border-ij-seam pt-4">
            <h4 className="text-xs uppercase tracking-wider text-ij-ink-info">Route decision</h4>
            {evidence.routeDecision === undefined || evidence.routeDecision === null ? (
              <p className="mt-2 text-ij-ink-info">No route decision recorded.</p>
            ) : (
              <pre className="mt-2 overflow-auto font-ij-mono text-xs text-ij-ink">
                {JSON.stringify(evidence.routeDecision, null, 2)}
              </pre>
            )}
          </section>
        </div>
      ) : declaredField ? (
        <div className="flex min-h-full flex-col">
          <div className="p-4">
            <p className="font-ij-mono text-xs text-ij-gold">declared field</p>
            <h3 className="mt-1 text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              {declaredField.label}
            </h3>
            <p className="mt-2 font-ij-mono text-xs text-ij-ink-info">{declaredField.fieldType}</p>
          </div>
          {whyNodeId ? (
            <div className="min-h-96 flex-1 border-t border-ij-seam">
              <WhyTrace target={{ kind: 'node', id: whyNodeId }} />
            </div>
          ) : (
            <p className="border-t border-ij-seam p-4 text-ij-ink-info">
              No provenance node is available for a why trace.
            </p>
          )}
        </div>
      ) : (
        <div className="p-4">
          <p className="font-ij-mono text-xs text-ij-ink-info">{selection.kind}</p>
          <p className="mt-2 break-all font-ij-mono text-ij-ink">{selection.key}</p>
        </div>
      )}
    </aside>
  );
}

const LENSES: readonly ModelLens[] = ['diagram', 'fields', 'records'];

export function ModelView({ set, host }: ViewRenderProps) {
  const initialScope = modelScopeFromSet(set) ?? { kind: 'topic' as const, topicId: '' };
  const [queryState, dispatch] = useReducer(
    reduceModelQuery,
    initialScope,
    createModelQueryState,
  );
  const [observed, setObserved] = useState(() => emptyObservedModel(initialScope));
  const [declared, setDeclared] = useState(() => emptyDeclaredModel(initialScope));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [scopeDraft, setScopeDraft] = useState(
    initialScope.kind === 'topic' ? initialScope.topicId : '',
  );
  const [proposalRequest, setProposalRequest] = useState('');
  const [proposal, setProposal] = useState<SchemaProposalDraft | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const setScope = modelScopeFromSet(set);
  const setScopeTopicId = setScope?.kind === 'topic' ? setScope.topicId : '';
  const setScopeTenant = setScope?.tenant;
  const topicId = queryState.scope.kind === 'topic' ? queryState.scope.topicId : '';

  useEffect(() => {
    if (!setScopeTopicId) return;
    dispatch({
      type: 'set-scope',
      scope: {
        kind: 'topic',
        topicId: setScopeTopicId,
        ...(setScopeTenant ? { tenant: setScopeTenant } : {}),
      },
    });
  }, [setScopeTenant, setScopeTopicId]);

  useEffect(() => {
    if (!topicId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const payload = await fetchObservedModel(topicId);
        if (!active) return;
        setObserved(payload.observed);
        setDeclared(payload.declared);
        setError(payload.error ?? null);
      } catch (loadError) {
        if (!active) return;
        const scope = { kind: 'topic' as const, topicId };
        setObserved(emptyObservedModel(scope));
        setDeclared(emptyDeclaredModel(scope));
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [topicId, reloadToken]);

  async function applyPin(
    observedKey: string,
    kind: PinKind,
    parentObservedKey?: string,
  ): Promise<void> {
    if (!topicId) return;
    dispatch({ type: 'pin-start', observedKey });
    setError(null);
    try {
      const result = await postPin({
        scope: { kind: 'topic', topicId },
        observedKey,
        kind,
        ...(parentObservedKey ? { parentObservedKey } : {}),
      }, host);
      setDeclared(result.declared);
      setNotice(result.receipt.note ?? `${observedKey} is declared.`);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : String(pinError));
    } finally {
      dispatch({ type: 'pin-finish', observedKey });
    }
  }

  async function applyUnpin(declaredId: string): Promise<void> {
    if (!topicId) return;
    setError(null);
    try {
      const result = await postUnpin(topicId, declaredId, host);
      setDeclared(result.declared);
      setNotice(result.receipt.note ?? `${declaredId} is no longer declared.`);
    } catch (unpinError) {
      setError(unpinError instanceof Error ? unpinError.message : String(unpinError));
    }
  }

  async function requestProposal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const request = proposalRequest.trim();
    if (!topicId || !request) return;
    setProposalBusy(true);
    setError(null);
    try {
      setProposal(await postSchemaProposal(topicId, request));
      setProposalRequest('');
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setProposalBusy(false);
    }
  }

  async function acceptProposal(): Promise<void> {
    if (!proposal) return;
    setProposalBusy(true);
    setError(null);
    try {
      let nextDeclared = declared;
      for (const pin of proposal.proposedPins) {
        dispatch({ type: 'pin-start', observedKey: pin.observedKey });
        try {
          const result = await postPin(pin, host);
          nextDeclared = result.declared;
        } finally {
          dispatch({ type: 'pin-finish', observedKey: pin.observedKey });
        }
      }
      setDeclared(nextDeclared);
      setNotice('Schema proposal accepted and declared.');
      setProposal(null);
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : String(proposalError));
    } finally {
      setProposalBusy(false);
    }
  }

  const lensProps = {
    observed,
    declared,
    selection: queryState.selection,
    pendingPins: queryState.pendingPins,
    onSelect: (selection: ModelSelection | null) => dispatch({ type: 'select', selection }),
    onPin: (observedKey: string, kind: PinKind, parentObservedKey?: string) => {
      void applyPin(observedKey, kind, parentObservedKey);
    },
    onUnpin: (declaredId: string) => {
      void applyUnpin(declaredId);
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-ij-editor text-ij-ink" data-model-studio>
      <header className="shrink-0 border-b border-ij-seam bg-ij-chrome">
        <div className="flex min-h-ij-toolbar flex-wrap items-center gap-3 px-3 py-1">
          <div className="min-w-0">
            <h1 style={{ fontWeight: 'var(--rec-weight-cap)' }}>Models</h1>
            <p className="font-ij-mono text-xs text-ij-ink-info">
              topic: {topicId || 'not selected'} · {observed.eventCount} events
            </p>
          </div>
          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextTopicId = scopeDraft.trim();
              if (!nextTopicId || nextTopicId === topicId) return;
              void host.emit({
                kind: 'update',
                id: MODEL_VIEW_INSTANCE_ID,
                patch: {
                  title: `Models: ${nextTopicId}`,
                  query: {
                    types: [
                      'model-scope',
                      'object-type-metadata',
                      'field-metadata',
                      'relation-metadata',
                      'view-metadata',
                      'schema-version',
                    ],
                    where: { kind: 'eq', field: 'topic_id', value: nextTopicId },
                    live: true,
                  } as unknown as JsonValue,
                },
              });
            }}
          >
            <label htmlFor="model-topic-scope" className="text-xs text-ij-ink-info">Topic scope</label>
            <input
              id="model-topic-scope"
              value={scopeDraft}
              onChange={(event) => setScopeDraft(event.target.value)}
              className="h-ij-control w-64 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 font-ij-mono focus:outline-2 focus:outline-ij-accent"
            />
            <button
              type="submit"
              disabled={!scopeDraft.trim() || scopeDraft.trim() === topicId}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
            >
              Apply
            </button>
          </form>
        </div>
        <div className="flex min-h-ij-control flex-wrap items-center gap-2 border-t border-ij-seam px-3 py-1">
          <div className="flex items-center gap-1" role="tablist" aria-label="Model lens">
            {LENSES.map((lens) => (
              <button
                key={lens}
                type="button"
                role="tab"
                aria-selected={queryState.lens === lens}
                onClick={() => dispatch({ type: 'switch-lens', lens })}
                className="h-ij-control rounded-ij-arc px-3 capitalize hover:bg-ij-hover-surface aria-selected:bg-ij-selection"
              >
                {lens}
              </button>
            ))}
          </div>
          <form className="ml-auto flex items-center gap-2" onSubmit={(event) => void requestProposal(event)}>
            <label htmlFor="schema-proposal-request" className="text-xs text-ij-ink-info">Schema change</label>
            <input
              id="schema-proposal-request"
              value={proposalRequest}
              onChange={(event) => setProposalRequest(event.target.value)}
              placeholder="Describe a proposed declaration"
              className="h-ij-control w-72 rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
            />
            <button
              type="submit"
              disabled={proposalBusy || !proposalRequest.trim()}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface disabled:opacity-50"
            >
              Propose
            </button>
          </form>
        </div>
      </header>

      {proposal ? (
        <ProposalCard
          draft={proposal}
          busy={proposalBusy}
          onAccept={() => void acceptProposal()}
          onDecline={() => setProposal(null)}
        />
      ) : null}

      {(!topicId || error) ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-error-bg px-3 py-2 text-ij-error" role="alert">
          <span>Observed model unavailable: {error ?? 'Model scope has no topic id.'}</span>
          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            className="ml-auto h-ij-control rounded-ij-arc border border-ij-control-border px-3 hover:bg-ij-hover-surface"
          >
            Retry
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="shrink-0 border-b border-ij-seam bg-ij-selection px-3 py-2 text-ij-ink" role="status">
          {notice}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <main className="min-h-96 min-w-0 flex-1">
          {loading && topicId ? (
            <div className="flex h-full items-center justify-center text-ij-ink-info">
              Loading observed model.
            </div>
          ) : queryState.lens === 'diagram' ? (
            <DiagramLens {...lensProps} />
          ) : queryState.lens === 'fields' ? (
            <FieldsTableLens {...lensProps} />
          ) : (
            <RecordsPreviewLens {...lensProps} />
          )}
        </main>
        <ModelInspector selection={queryState.selection} observed={observed} declared={declared} />
      </div>
    </div>
  );
}
