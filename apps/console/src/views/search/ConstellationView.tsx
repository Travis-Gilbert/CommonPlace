'use client';

// SOURCING: d3 through @commonplace/search-stack deterministic layout. React
// owns the SVG marks. All paint resolves through the Int UI register.

import {
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useReducedMotion } from 'motion/react';
import {
  constellationDegradedNotes,
  constellationPayloadOf,
  layoutConstellation,
  type ConstellationEdge,
  type ConstellationMemoryNode,
  type ConstellationNode,
  type ConstellationPayload,
  type ConstellationState,
} from '@commonplace/search-stack';

const VIEW_WIDTH = 880;
const VIEW_HEIGHT = 520;
const RESULT_HALF_WIDTH = 84;
const RESULT_HALF_HEIGHT = 34;
const MEMORY_HALF_WIDTH = 58;
const MEMORY_HALF_HEIGHT = 34;

export interface ConstellationViewProps {
  readonly state: ConstellationState;
  readonly listSlot?: ReactNode;
  readonly onEditQuery?: (query: string) => void;
  readonly onRetry?: () => void;
  readonly onOpenResult?: (url: string, node: ConstellationNode) => void;
  readonly onExpandNode?: (node: ConstellationNode) => void;
  readonly onOpenMemoryAtom?: (
    atomRef: string,
    node: ConstellationMemoryNode,
  ) => void;
}

export function ConstellationView({
  state,
  listSlot,
  onEditQuery,
  onRetry,
  onOpenResult,
  onExpandNode,
  onOpenMemoryAtom,
}: ConstellationViewProps) {
  const [listOpen, setListOpen] = useState(false);
  const payload = constellationPayloadOf(state);

  return (
    <section
      aria-label={`Search constellation, ${state.kind}`}
      data-search-constellation
      data-state={state.kind}
      className="min-h-0 border border-ij-seam-raised bg-ij-editor text-ij-ink"
    >
      <header className="flex h-ij-toolbar items-center justify-between gap-3 border-b border-ij-seam bg-ij-chrome px-3">
        <p className="truncate font-ij-mono text-ij-ink-info">
          {payload?.meta.query ?? 'Search constellation'}
        </p>
        <button
          type="button"
          onClick={() => setListOpen((current) => !current)}
          className="h-ij-control rounded-ij-arc px-3 text-ij-link hover:bg-ij-hover-surface"
        >
          {listOpen ? 'Show constellation' : 'Show plain list'}
        </button>
      </header>

      {listOpen ? (
        <div className="max-h-full overflow-y-auto">
          {listSlot ?? (
            <p className="p-4 text-ij-ink-info">
              The plain list is not available for this projection.
            </p>
          )}
        </div>
      ) : (
        <ConstellationBody
          state={state}
          onEditQuery={onEditQuery}
          onRetry={onRetry}
          onOpenResult={onOpenResult}
          onExpandNode={onExpandNode}
          onOpenMemoryAtom={onOpenMemoryAtom}
        />
      )}
    </section>
  );
}

function ConstellationBody({
  state,
  onEditQuery,
  onRetry,
  onOpenResult,
  onExpandNode,
  onOpenMemoryAtom,
}: Omit<ConstellationViewProps, 'state' | 'listSlot'> & {
  readonly state: ConstellationState;
}) {
  if (state.kind === 'loading') {
    return (
      <div role="status" className="grid gap-2 p-6 text-ij-ink-info">
        <span>Admitting results</span>
        {state.narration ? <span>{state.narration}</span> : null}
        <span className="sr-only">The settled layout will appear when results arrive.</span>
      </div>
    );
  }
  if (state.kind === 'empty') {
    return (
      <div className="grid gap-3 p-6 text-ij-ink-info">
        <p>{state.reason}</p>
        {onEditQuery ? (
          <button
            type="button"
            onClick={() => onEditQuery('')}
            className="h-ij-control w-fit rounded-ij-arc border border-ij-control-border px-3 text-ij-ink hover:bg-ij-hover-surface"
          >
            Edit query
          </button>
        ) : null}
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div role="alert" className="grid gap-3 p-6">
        <p className="text-ij-error">{state.cause}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="h-ij-control w-fit rounded-ij-arc bg-ij-accent px-3 text-ij-ink-bright hover:bg-ij-accent-hover"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <ConstellationGraph
      payload={state.payload}
      degradedNotes={constellationDegradedNotes(state)}
      onOpenResult={onOpenResult}
      onExpandNode={onExpandNode}
      onOpenMemoryAtom={onOpenMemoryAtom}
    />
  );
}

function ConstellationGraph({
  payload,
  degradedNotes,
  onOpenResult,
  onExpandNode,
  onOpenMemoryAtom,
}: {
  readonly payload: ConstellationPayload;
  readonly degradedNotes: readonly string[];
  readonly onOpenResult?: (url: string, node: ConstellationNode) => void;
  readonly onExpandNode?: (node: ConstellationNode) => void;
  readonly onOpenMemoryAtom?: (
    atomRef: string,
    node: ConstellationMemoryNode,
  ) => void;
}) {
  const domId = useId().replaceAll(':', '');
  const reducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const layout = useMemo(
    () => layoutConstellation({
      query: payload.meta.query,
      nodes: [
        ...payload.nodes.map((node) => ({
          id: node.id,
          kind: 'result' as const,
        })),
        ...payload.memoryNodes.map((node) => ({
          id: node.id,
          kind: 'memory' as const,
        })),
      ],
      edges: payload.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    }),
    [payload],
  );

  return (
    <div
      className="flex min-h-0 flex-col xl:flex-row"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="group"
        aria-label={`Constellation of ${payload.nodes.length} results and ${payload.memoryNodes.length} memory nodes`}
        className="min-h-80 min-w-0 flex-1 bg-ij-editor"
      >
        <g>
          {payload.edges.map((edge) => {
            const from = layout.get(edge.source);
            const to = layout.get(edge.target);
            if (!from || !to) return null;
            const id = edgeKey(edge);
            return (
              <g
                key={id}
                role="group"
                tabIndex={0}
                aria-label={edgeAnnotation(edge)}
                aria-describedby={`${domId}-${id}`}
                data-active={activeId === id ? 'true' : undefined}
                onFocus={() => setActiveId(id)}
                onBlur={() => setActiveId(null)}
                onMouseEnter={() => setActiveId(id)}
                onMouseLeave={() => setActiveId(null)}
                className="outline-none"
              >
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={activeId === id ? 'var(--ij-accent)' : 'var(--ij-divider)'}
                  strokeWidth={activeId === id ? 2 : 1}
                />
              </g>
            );
          })}
        </g>

        <g>
          {payload.nodes.map((node) => {
            const point = layout.get(node.id);
            if (!point) return null;
            return (
              <g
                key={node.id}
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={nodeAnnotation(node, Boolean(onExpandNode))}
                aria-describedby={`${domId}-${node.id}`}
                data-kind="result"
                data-relation={node.relation}
                data-active={activeId === node.id ? 'true' : undefined}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId(null)}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId(null)}
                onClick={() => onOpenResult?.(node.url, node)}
                onDoubleClick={(event) => {
                  if (!onExpandNode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onExpandNode(node);
                }}
                onKeyDown={(event) => {
                  if (onExpandNode && event.key.toLowerCase() === 'e') {
                    event.preventDefault();
                    onExpandNode(node);
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenResult?.(node.url, node);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={-RESULT_HALF_WIDTH}
                  y={-RESULT_HALF_HEIGHT}
                  width={RESULT_HALF_WIDTH * 2}
                  height={RESULT_HALF_HEIGHT * 2}
                  rx={2}
                  fill={activeId === node.id ? 'var(--ij-selection)' : 'var(--ij-raised)'}
                  stroke={
                    node.relation === 'CONTRADICTS'
                      ? 'var(--ij-accent)'
                      : 'var(--ij-seam-raised)'
                  }
                  strokeWidth={activeId === node.id ? 2 : 1}
                />
                <text
                  x={-RESULT_HALF_WIDTH + 10}
                  y={-5}
                  fill="var(--ij-ink)"
                  className="font-ij-ui"
                >
                  {truncate(node.title, 25)}
                </text>
                <text
                  x={-RESULT_HALF_WIDTH + 10}
                  y={16}
                  fill="var(--ij-ink-info)"
                  className="font-ij-ui"
                >
                  {truncate(node.description ?? hostOf(node.url), 32)}
                </text>
              </g>
            );
          })}

          {payload.memoryNodes.map((node) => {
            const point = layout.get(node.id);
            if (!point) return null;
            return (
              <g
                key={node.id}
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={memoryAnnotation(node)}
                aria-describedby={`${domId}-${node.id}`}
                data-kind="memory"
                onClick={() => onOpenMemoryAtom?.(node.atomRef, node)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenMemoryAtom?.(node.atomRef, node);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <path
                  d={hexagonPath(MEMORY_HALF_WIDTH, MEMORY_HALF_HEIGHT)}
                  fill="var(--ij-gold-tint)"
                  stroke="var(--ij-gold)"
                  strokeWidth={2}
                />
                <text
                  x={0}
                  y={-4}
                  textAnchor="middle"
                  fill="var(--ij-gold)"
                  className="font-ij-ui"
                >
                  {truncate(node.title, 20)}
                </text>
                <text
                  x={0}
                  y={15}
                  textAnchor="middle"
                  fill="var(--ij-ink-info)"
                  className="font-ij-ui"
                >
                  Memory
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <AnnotationColumn
        domId={domId}
        payload={payload}
        degradedNotes={degradedNotes}
        activeId={activeId}
        onActivate={setActiveId}
      />
    </div>
  );
}

function AnnotationColumn({
  domId,
  payload,
  degradedNotes,
  activeId,
  onActivate,
}: {
  readonly domId: string;
  readonly payload: ConstellationPayload;
  readonly degradedNotes: readonly string[];
  readonly activeId: string | null;
  readonly onActivate: (id: string | null) => void;
}) {
  return (
    <aside className="max-h-96 w-full overflow-y-auto border-t border-ij-seam bg-ij-chrome p-3 xl:max-h-none xl:w-80 xl:border-l xl:border-t-0">
      <h3 className="text-ij-ink">Why these, and why connected</h3>
      <ul aria-label="Nodes" className="mt-2 grid gap-2">
        {payload.nodes.map((node) => (
          <li
            key={node.id}
            id={`${domId}-${node.id}`}
            data-active={activeId === node.id ? 'true' : undefined}
            onMouseEnter={() => onActivate(node.id)}
            onMouseLeave={() => onActivate(null)}
            className="border-l border-ij-divider pl-2 text-ij-ink-info data-[active=true]:border-ij-accent data-[active=true]:text-ij-ink"
          >
            <strong className="block font-medium text-ij-ink">
              {node.admittedRank}. {node.title}
            </strong>
            <span>{relationSentence(node.relation)}</span>
          </li>
        ))}
        {payload.memoryNodes.map((node) => (
          <li
            key={node.id}
            id={`${domId}-${node.id}`}
            className="border-l border-ij-gold pl-2 text-ij-ink-info"
          >
            <strong className="block font-medium text-ij-gold">{node.title}</strong>
            <span>{node.connectionExplanation}</span>
          </li>
        ))}
      </ul>

      <ul aria-label="Connections" className="mt-3 grid gap-2 border-t border-ij-seam pt-3">
        {payload.edges.length === 0 ? (
          <li className="text-ij-ink-info">
            No connection survived the evidence test. These results stand apart.
          </li>
        ) : null}
        {payload.edges.map((edge) => {
          const id = edgeKey(edge);
          return (
            <li
              key={id}
              id={`${domId}-${id}`}
              data-active={activeId === id ? 'true' : undefined}
              className="border-l border-ij-divider pl-2 text-ij-ink-info data-[active=true]:border-ij-accent data-[active=true]:text-ij-ink"
            >
              <strong className="block font-medium text-ij-ink">
                {reasonLabel(edge.reason.type)}
              </strong>
              <span>{edge.reason.text}</span>
              <span className="block font-ij-mono text-ij-island-meta">
                Evidence: {edge.reason.evidenceRefs.join(', ')}
              </span>
            </li>
          );
        })}
      </ul>

      {degradedNotes.length ? (
        <ul aria-label="Degraded providers" className="mt-3 grid gap-1 border-t border-ij-seam pt-3 text-ij-warn">
          {degradedNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}
    </aside>
  );
}

export function nodeAnnotation(
  node: ConstellationNode,
  expandable = false,
): string {
  return [
    `Result ${node.admittedRank}: ${node.title}`,
    node.description,
    relationSentence(node.relation),
    hostOf(node.url),
    expandable ? 'Double click or press E to expand this node' : undefined,
  ].filter((part): part is string => Boolean(part)).join('. ');
}

export function memoryAnnotation(node: ConstellationMemoryNode): string {
  return `Memory node: ${node.title}. ${node.connectionExplanation}. Opens the memory atom ${node.atomRef}`;
}

export function edgeAnnotation(edge: ConstellationEdge): string {
  return `${reasonLabel(edge.reason.type)} between ${edge.source} and ${edge.target}. ${edge.reason.text} Evidence: ${edge.reason.evidenceRefs.join(', ')}`;
}

function relationSentence(relation: ConstellationNode['relation']): string {
  switch (relation) {
    case 'KNOWN':
      return 'You already know this';
    case 'EXTENDS':
      return 'This extends what you know';
    case 'CONTRADICTS':
      return 'This contradicts what you know';
    case 'ORPHAN':
      return 'This connects to nothing you hold yet';
  }
}

function reasonLabel(type: ConstellationEdge['reason']['type']): string {
  switch (type) {
    case 'field_fact_intersect':
      return 'Shared field fact';
    case 'citation':
      return 'Citation';
    case 'shared_source':
      return 'Shared source';
    case 'shared_author':
      return 'Shared author';
    case 'graph_edge':
      return 'Edge in your graph';
    case 'memory_exact_tier':
      return 'Exact tier memory match';
  }
}

function edgeKey(edge: ConstellationEdge): string {
  return `${edge.source}-${edge.target}-${edge.reason.type}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max
    ? value
    : `${value.slice(0, Math.max(1, max - 3)).trimEnd()}...`;
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./, '') : url;
}

function hexagonPath(halfWidth: number, halfHeight: number): string {
  const inset = halfWidth * 0.5;
  return [
    `M ${-halfWidth} 0`,
    `L ${-inset} ${-halfHeight}`,
    `L ${inset} ${-halfHeight}`,
    `L ${halfWidth} 0`,
    `L ${inset} ${halfHeight}`,
    `L ${-inset} ${halfHeight}`,
    'Z',
  ].join(' ');
}
