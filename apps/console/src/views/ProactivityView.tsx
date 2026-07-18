'use client';

// SOURCING: @commonplace/block-view (ViewRenderProps). The proactivity graph
// surface (PG2): the editable standing structure, one object at three
// altitudes (PG3). It reconstructs the projected graph from the queried
// ObjectRefs, resolves the tenant refusal (named choice 10) as the unavailable
// state, and renders the five states through the shared wait ladder. The
// altitude tablist is APG (arrow keys, Home, End). Disable, permission, and
// budget render inside the altitudes on every relevant node; nothing here is a
// bespoke page, and nothing animates (the register rule), so the reduced-motion
// pass is identical.

import { useMemo, useState, type KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import type { EffectContract, ProactivityGraph } from '@/lib/proactivity/model';
import { graphFromObjects } from '@/lib/proactivity/object-bridge';
import { REFUSAL_NOTE } from '@/lib/proactivity/store';
import { ViewState } from './ViewStates';
import { SentenceAltitude } from './proactivity/SentenceAltitude';
import { CardAltitude } from './proactivity/CardAltitude';
import { IntentComposer } from './proactivity/IntentComposer';
import { sourcesOf } from './proactivity/kinds';
import { useProactivityEdits } from './proactivity/use-edits';

// The graph altitude, and the elkjs layout library it dynamically imports, load
// only when the graph altitude is opened (PG3: the list renders with no graph
// bundle). The whole graph chunk is code-split behind this boundary.
const GraphAltitude = dynamic(() => import('./proactivity/GraphAltitude').then((mod) => mod.GraphAltitude), {
  ssr: false,
  loading: () => <ViewState state="loading" />,
});

type Altitude = 'sentence' | 'card' | 'graph';

const ALTITUDES: readonly { readonly id: Altitude; readonly label: string }[] = [
  { id: 'sentence', label: 'Sentences' },
  { id: 'card', label: 'Cards' },
  { id: 'graph', label: 'Graph' },
];

export function ProactivityView({ set, host }: ViewRenderProps) {
  const [altitude, setAltitude] = useState<Altitude>('sentence');
  const edits = useProactivityEdits(host);

  const refused = set.notes?.includes(REFUSAL_NOTE) ?? false;
  const rebuilt = useMemo(() => graphFromObjects(set.objects), [set.objects]);
  const graph: ProactivityGraph = useMemo(
    () => ({ tenant: rebuilt.tenant ?? '', nodes: rebuilt.nodes, edges: rebuilt.edges }),
    [rebuilt],
  );
  const contracts = useMemo<readonly EffectContract[]>(() => {
    const map = new Map<string, EffectContract>();
    for (const node of graph.nodes) if (node.kind === 'response') map.set(node.effectContract.id, node.effectContract);
    return [...map.values()];
  }, [graph]);

  if (refused) {
    return <ViewState state="unavailable" capability="a resolved tenant for the proactivity graph" />;
  }
  if (graph.nodes.length === 0) {
    return <ViewState state="empty" />;
  }

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = ALTITUDES.length - 1;
    let next = index;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    setAltitude(ALTITUDES[next].id);
  };

  return (
    <div className="flex h-full flex-col bg-ij-editor" data-surface="proactivity">
      <header className="flex flex-col gap-3 border-b border-ij-divider p-4">
        <div className="flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Altitude"
            className="flex items-center gap-1 rounded-ij-arc bg-ij-chrome p-1"
          >
            {ALTITUDES.map((option, index) => {
              const selected = altitude === option.id;
              return (
                <button
                  key={option.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`rounded-ij-arc px-3 py-1 text-sm ${selected ? 'bg-ij-accent text-ij-ink-bright' : 'text-ij-ink-info hover:bg-ij-hover-surface'}`}
                  onClick={() => setAltitude(option.id)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {edits.canUndo ? (
            <button
              type="button"
              className="rounded-ij-arc border border-ij-control-border px-3 py-1 text-sm text-ij-ink hover:bg-ij-hover-surface"
              onClick={() => void edits.undo()}
            >
              Undo {edits.nextUndoLabel}
            </button>
          ) : null}
        </div>
        <IntentComposer host={host} sources={sourcesOf(graph.nodes)} contracts={contracts} />
        {edits.error ? (
          <p className="rounded-ij-arc bg-ij-error-bg px-3 py-1 text-sm text-ij-error" role="alert">
            {edits.error}
            <button type="button" className="ml-2 text-ij-ink-info" onClick={edits.clearError}>
              dismiss
            </button>
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {altitude === 'sentence' ? <SentenceAltitude graph={graph} host={host} edits={edits} contracts={contracts} /> : null}
        {altitude === 'card' ? <CardAltitude graph={graph} edits={edits} contracts={contracts} /> : null}
        {altitude === 'graph' ? <GraphAltitude graph={graph} edits={edits} contracts={contracts} /> : null}
      </div>
    </div>
  );
}
