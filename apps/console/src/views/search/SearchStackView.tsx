'use client';

// SOURCING: @commonplace/search-stack controller and projections. This is a
// greenfield console renderer with no legacy application imports or copied styles.

import { useCallback, useMemo, useState } from 'react';
import {
  constellationPayloadOf,
  constellationStateOf,
  scatterOf,
  selectedFindOf,
  type AspectNode,
  type ConstellationNode,
  type FindResult,
  type SearchStackController,
  type SessionOrigin,
} from '@commonplace/search-stack';
import { AspectList } from './AspectList';
import { ConstellationView } from './ConstellationView';
import { DockedMap } from './DockedMap';
import { LambdaDial } from './LambdaDial';
import { RelationMark, relationLabel } from './RelationMark';
import { SaveUrlButton } from './SaveUrlButton';
import {
  consoleSearchController,
  createConsoleSearchController,
} from './search-client';
import { openSearchPageInWebEdition } from './search-host';
import { useSearchStack } from './use-search-stack';

export interface SearchStackViewProps {
  readonly controller?: SearchStackController;
  readonly sessionId?: string | null;
  readonly onOpenPage?: (
    url: string,
    node: ConstellationNode,
  ) => Promise<void>;
  readonly onRecordSessionOrigin?: (
    sessionId: string,
    origin: SessionOrigin,
  ) => Promise<void>;
}

export function SearchStackView({
  controller: providedController,
  sessionId = null,
  onOpenPage = openSearchPageInWebEdition,
  onRecordSessionOrigin,
}: SearchStackViewProps) {
  const ownedController = useMemo(() => createConsoleSearchController(), []);
  const controller = providedController ?? ownedController;
  const state = useSearchStack(controller);
  const [draft, setDraft] = useState('');
  const scatter = scatterOf(state);
  const find = selectedFindOf(state);
  const constellation = constellationStateOf(state);
  const aspectLabel = state.selectedAspect
    ? scatter?.aspects.find((aspect) => aspect.id === state.selectedAspect)?.label
    : null;

  const openNode = useCallback(
    (node: ConstellationNode) => {
      void controller.openNode(node, {
        sessionId,
        open: onOpenPage,
        recordOrigin: onRecordSessionOrigin,
      });
    },
    [controller, onOpenPage, onRecordSessionOrigin, sessionId],
  );

  const openResult = useCallback(
    (_url: string, node: ConstellationNode) => {
      if (state.layer === 'scatter') {
        void controller.selectAspect(node.id);
      } else {
        openNode(node);
      }
    },
    [controller, openNode, state.layer],
  );

  const openFromList = useCallback(
    (result: FindResult) => {
      if (!result.hit.source) return;
      openNode({
        id: result.hit.doc,
        url: result.hit.source,
        title: result.hit.title ?? result.hit.doc,
        description: result.hit.snippet,
        admittedRank: 1,
        relation: result.relation,
      });
    },
    [openNode],
  );

  const listSlot = state.layer === 'aspect' && find ? (
    <AspectList response={find} onOpen={openFromList} />
  ) : (
    <AspectRoster
      aspects={scatter?.aspects ?? []}
      labeler={scatter?.labeler}
      expanding={state.expanding}
      onOpen={(id) => void controller.selectAspect(id)}
      onExpand={(id) => void controller.expandAspect(id)}
    />
  );

  const submit = () => {
    const query = draft.trim();
    if (query) void controller.submit(query);
  };

  return (
    <div
      data-search-stack-view
      data-layer={state.layer}
      className="relative flex h-full min-h-0 flex-col bg-ij-editor font-ij-ui text-ij-ink"
    >
      <header className="grid shrink-0 gap-2 border-b border-ij-seam bg-ij-chrome p-3">
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex min-w-64 flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              aria-label="Ask search a question"
              placeholder="Scatter a question into aspects"
              className="h-ij-control min-w-0 flex-1 rounded-ij-arc border border-ij-control-border bg-ij-editor px-3 text-ij-ink outline-none placeholder:text-ij-ink-disabled focus:border-ij-accent"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="h-ij-control rounded-ij-arc bg-ij-accent px-4 text-ij-ink-bright hover:bg-ij-accent-hover disabled:text-ij-ink-disabled"
            >
              Scatter
            </button>
          </form>
          <LambdaDial lambda={state.lambda} onChange={controller.setLambda} />
          <SaveUrlButton url={state.stage?.url} />
        </div>

        <nav aria-label="Search layers" className="flex items-center gap-2 font-ij-mono text-ij-ink-info">
          <button
            type="button"
            disabled={state.layer === 'scatter'}
            aria-current={state.layer === 'scatter' ? 'page' : undefined}
            onClick={controller.backToScatter}
            className="h-ij-row rounded-ij-arc-underline px-2 hover:bg-ij-hover-surface aria-[current=page]:bg-ij-selection aria-[current=page]:text-ij-ink"
          >
            Aspects
          </button>
          {aspectLabel ? (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="text-ij-ink">{aspectLabel}</span>
            </>
          ) : null}
          {state.expanding ? (
            <span role="status" className="ml-auto text-ij-ink-info">
              Re-scattering {state.expanding}
            </span>
          ) : null}
        </nav>
      </header>

      {state.error ? (
        <p role="status" className="border-b border-ij-seam bg-ij-error-bg px-3 py-1 text-ij-error">
          {state.error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
          <ConstellationView
            state={constellation}
            listSlot={listSlot}
            onOpenResult={openResult}
            onExpandNode={
              state.layer === 'scatter'
                ? (node) => void controller.expandAspect(node.id)
                : undefined
            }
            onEditQuery={(query) => setDraft(query)}
            onRetry={() => {
              if (state.layer === 'aspect' && state.selectedAspect) {
                void controller.selectAspect(state.selectedAspect);
              } else if (state.query) {
                void controller.submit(state.query);
              }
            }}
          />
        </main>
        {state.docked ? (
          <aside
            data-search-session-rail
            aria-label="Search session"
            className="w-64 shrink-0 overflow-y-auto border-l border-ij-seam bg-ij-chrome p-2"
          >
            <DockedSearchMap controller={controller} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export function DockedSearchMap({
  controller = consoleSearchController,
}: {
  readonly controller?: SearchStackController;
}) {
  const state = useSearchStack(controller);
  const payload = constellationPayloadOf(constellationStateOf(state));
  if (!state.docked || !payload) return null;
  return (
    <DockedMap
      payload={payload}
      visited={state.visited}
      onReopen={controller.reopenMap}
    />
  );
}

function AspectRoster({
  aspects,
  labeler,
  expanding,
  onOpen,
  onExpand,
}: {
  readonly aspects: readonly AspectNode[];
  readonly labeler?: string;
  readonly expanding: string | null;
  readonly onOpen: (id: string) => void;
  readonly onExpand: (id: string) => void;
}) {
  if (aspects.length === 0) {
    return <p className="p-4 text-ij-ink-info">No aspect has been scattered yet.</p>;
  }
  return (
    <ol aria-label="Aspects" className="m-0 grid list-none gap-1 p-0">
      {aspects.map((aspect, index) => (
        <li
          key={aspect.id}
          data-relation={aspect.relation}
          className="flex items-start gap-3 border-b border-ij-seam px-3 py-3"
        >
          <span className="font-ij-mono text-ij-island-meta tabular-nums text-ij-ink-disabled">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate font-medium text-ij-ink">
              {aspect.label}
            </strong>
            <span className="mt-1 flex flex-wrap items-center gap-2 font-ij-mono text-ij-island-meta text-ij-ink-info">
              <span className="inline-flex items-center gap-1 uppercase">
                <RelationMark relation={aspect.relation} decorative />
                {relationLabel(aspect.relation)}
              </span>
              <span>
                {aspect.seedHits.length === 1
                  ? '1 seed'
                  : `${aspect.seedHits.length} seeds`}
              </span>
              {labeler ? <span>labeled by {labeler}</span> : null}
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onOpen(aspect.id)}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-ij-ink hover:bg-ij-hover-surface"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => onExpand(aspect.id)}
              disabled={expanding === aspect.id}
              className="h-ij-control rounded-ij-arc border border-ij-control-border px-2 text-ij-ink hover:bg-ij-hover-surface disabled:text-ij-ink-disabled"
            >
              {expanding === aspect.id ? 'Expanding' : 'Expand'}
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
