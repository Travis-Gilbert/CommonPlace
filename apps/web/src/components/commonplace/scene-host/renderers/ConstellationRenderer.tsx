// SOURCING: d3 (d3-force layout via @/lib/constellation-layout) + motion (staggered entrance, useReducedMotion). SVG marks are hand-rolled because the annotated eight node forest is a domain surface no chart library models.
'use client';

/**
 * Search constellation renderer (HANDOFF-SEARCH-CONSTELLATION D2, D3, D5).
 *
 * Registered under the `force_graph` projection id through the scene renderer
 * registry, so it resolves as a view descriptor rather than a bespoke route.
 *
 * Geometry comes from the seeded d3-force layout, which settles before paint.
 * Annotation comes from the constellation payload the scene package carries
 * under `provenance.constellation`. Nodes and edges are focusable elements
 * whose accessible names are their annotations, and the annotation column is a
 * real list rather than decoration.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type {
  ConstellationEdge,
  ConstellationMemoryNode,
  ConstellationNode,
  ConstellationPayload,
  ConstellationState,
} from '@commonplace/block-view-contracts/search-stack';
import {
  constellationDegradedNotes,
  constellationPayloadOf,
  readConstellationState,
} from '@/lib/constellation-payload';
import {
  CONSTELLATION_MEMORY_RADIUS,
  CONSTELLATION_NODE_RADIUS,
  layoutConstellation,
  type ConstellationLayout,
  type ConstellationLayoutEdge,
  type ConstellationLayoutNode,
  type ConstellationPoint,
} from '@/lib/constellation-layout';
import type { SceneRendererProps } from '../types';

/** Wait ladder T1: the quiet micro state holds this long before narration. */
export const CONSTELLATION_T1_MS = 420;

const VIEW_WIDTH = 880;
const VIEW_HEIGHT = 520;
const RESULT_HALF_WIDTH = 84;
const RESULT_HALF_HEIGHT = 34;
const MEMORY_HALF_WIDTH = 58;
const MEMORY_HALF_HEIGHT = 34;

export interface ConstellationRendererProps extends SceneRendererProps {
  /** Host callback for the plain list toggle. The toggle also reveals `listSlot`. */
  onShowList?: () => void;
  /** The plain list component. Owned by another deliverable, rendered here. */
  listSlot?: ReactNode;
  /** Offered by the empty state so the person can edit the query. */
  onEditQuery?: (query: string) => void;
  /** Offered by the error state. */
  onRetry?: () => void;
  /** Opens the memory atom. Never a web navigation. */
  onOpenMemoryAtom?: (atomRef: string, node: ConstellationMemoryNode) => void;
  /** Opens a result. Defaults to a typed window event so nothing is inert. */
  onOpenResult?: (url: string, node: ConstellationNode) => void;
  /**
   * The expand gesture (SPEC F2): re-scatter within this node. Double click, or
   * press E while the node has focus. Absent means the scene has nothing to
   * expand into, and the gesture is not advertised in the accessible name.
   */
  onExpandNode?: (node: ConstellationNode) => void;
}

export default function ConstellationRenderer(props: ConstellationRendererProps) {
  const { scenePackage } = props;
  const state = useMemo(() => readConstellationState(scenePackage), [scenePackage]);
  return <ConstellationSurface {...props} state={state} />;
}

/** Renders a state directly. Used by the fixture tests and by streaming hosts. */
export function ConstellationSurface({
  state,
  validationReason,
  onShowList,
  listSlot,
  onEditQuery,
  onRetry,
  onOpenMemoryAtom,
  onOpenResult,
  onExpandNode,
}: Omit<ConstellationRendererProps, 'scenePackage'> & { state: ConstellationState }) {
  const [listOpen, setListOpen] = useState(false);
  const payload = constellationPayloadOf(state);
  const degradedNotes = useMemo(() => constellationDegradedNotes(state), [state]);

  const showList = useCallback(() => {
    setListOpen((open) => !open);
    if (onShowList) onShowList();
    else emitConstellationEvent('commonplace:constellation-show-list', {});
  }, [onShowList]);

  return (
    <section
      className="cp-constellation"
      data-state={state.kind}
      aria-label={`Search constellation, ${state.kind}`}
    >
      <header className="cp-constellation-bar">
        <p className="cp-constellation-kicker">
          {payload ? payload.meta.query : 'Search constellation'}
        </p>
        <button type="button" className="cp-constellation-toggle" onClick={showList}>
          {listOpen ? 'Show constellation' : 'Show plain list'}
        </button>
      </header>

      {validationReason && <p className="cp-scene-validation-reason">{validationReason}</p>}

      {listOpen ? (
        <div className="cp-constellation-list-slot">
          {listSlot ?? <PlainListPending />}
        </div>
      ) : (
        <ConstellationBody
          state={state}
          payload={payload}
          degradedNotes={degradedNotes}
          onEditQuery={onEditQuery}
          onRetry={onRetry}
          onOpenMemoryAtom={onOpenMemoryAtom}
          onOpenResult={onOpenResult}
          onExpandNode={onExpandNode}
        />
      )}
    </section>
  );
}

function ConstellationBody({
  state,
  payload,
  degradedNotes,
  onEditQuery,
  onRetry,
  onOpenMemoryAtom,
  onOpenResult,
  onExpandNode,
}: {
  state: ConstellationState;
  payload: ConstellationPayload | undefined;
  degradedNotes: readonly string[];
  onEditQuery?: (query: string) => void;
  onRetry?: () => void;
  onOpenMemoryAtom?: (atomRef: string, node: ConstellationMemoryNode) => void;
  onOpenResult?: (url: string, node: ConstellationNode) => void;
  onExpandNode?: (node: ConstellationNode) => void;
}) {
  if (state.kind === 'loading') return <LoadingLadder narration={state.narration} />;
  if (state.kind === 'empty') return <EmptyState reason={state.reason} onEditQuery={onEditQuery} />;
  if (state.kind === 'error') return <ErrorState cause={state.cause} onRetry={onRetry} />;
  if (!payload) return <ErrorState cause="This state carries no constellation payload." onRetry={onRetry} />;
  return (
    <ConstellationGraph
      payload={payload}
      degradedNotes={degradedNotes}
      onOpenMemoryAtom={onOpenMemoryAtom}
      onOpenResult={onOpenResult}
      onExpandNode={onExpandNode}
    />
  );
}

// ---------------------------------------------------------------------------
// Graph plus annotation column
// ---------------------------------------------------------------------------

function ConstellationGraph({
  payload,
  degradedNotes,
  onOpenMemoryAtom,
  onOpenResult,
  onExpandNode,
}: {
  payload: ConstellationPayload;
  degradedNotes: readonly string[];
  onOpenMemoryAtom?: (atomRef: string, node: ConstellationMemoryNode) => void;
  onOpenResult?: (url: string, node: ConstellationNode) => void;
  onExpandNode?: (node: ConstellationNode) => void;
}) {
  const domId = useId().replace(/:/g, '');
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);

  const layoutNodes = useMemo<ConstellationLayoutNode[]>(
    () => [
      ...payload.nodes.map((node) => ({ id: node.id, kind: 'result' as const })),
      ...payload.memoryNodes.map((node) => ({ id: node.id, kind: 'memory' as const })),
    ],
    [payload.nodes, payload.memoryNodes],
  );
  const layoutEdges = useMemo<ConstellationLayoutEdge[]>(
    () => payload.edges.map((edge) => ({ source: edge.source, target: edge.target })),
    [payload.edges],
  );
  const layout = useConstellationLayout(payload.meta.query, layoutNodes, layoutEdges);

  const memoryById = useMemo(
    () => new Map(payload.memoryNodes.map((node) => [node.id, node] as const)),
    [payload.memoryNodes],
  );

  const activeCallout = useMemo(
    () => calloutFor(activeId, payload, layout, memoryById),
    [activeId, payload, layout, memoryById],
  );

  const openResult = useCallback(
    (node: ConstellationNode) => {
      if (onOpenResult) onOpenResult(node.url, node);
      else emitConstellationEvent('commonplace:constellation-open-result', { url: node.url, id: node.id });
    },
    [onOpenResult],
  );

  const expandNode = useCallback(
    (node: ConstellationNode) => {
      if (onExpandNode) onExpandNode(node);
    },
    [onExpandNode],
  );

  const openMemory = useCallback(
    (node: ConstellationMemoryNode) => {
      if (onOpenMemoryAtom) onOpenMemoryAtom(node.atomRef, node);
      else emitConstellationEvent('commonplace:open-memory-atom', { atomRef: node.atomRef, id: node.id });
    },
    [onOpenMemoryAtom],
  );

  return (
    <div className="cp-constellation-body">
      <svg
        className="cp-constellation-canvas"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="group"
        aria-label={`Constellation of ${payload.nodes.length} results and ${payload.memoryNodes.length} memory nodes`}
      >
        <g className="cp-constellation-edges">
          {payload.edges.map((edge) => {
            const from = layout.get(edge.source);
            const to = layout.get(edge.target);
            if (!from || !to) return null;
            const edgeId = edgeKey(edge);
            const label = edgeAnnotation(edge);
            return (
              <MotionMark
                key={edgeId}
                reduceMotion={reduceMotion}
                index={0}
                className="cp-constellation-edge"
                data-reason={edge.reason.type}
                data-active={activeId === edgeId ? 'true' : undefined}
                tabIndex={0}
                role="group"
                aria-label={label}
                aria-describedby={`${domId}-a-${edgeId}`}
                onFocus={() => setActiveId(edgeId)}
                onBlur={() => setActiveId((current) => (current === edgeId ? null : current))}
                onMouseEnter={() => setActiveId(edgeId)}
                onMouseLeave={() => setActiveId((current) => (current === edgeId ? null : current))}
              >
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cp-constellation-edge-hit" />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cp-constellation-edge-line" />
              </MotionMark>
            );
          })}
        </g>

        <g className="cp-constellation-nodes">
          {payload.nodes.map((node, index) => {
            const point = layout.get(node.id);
            if (!point) return null;
            return (
              <g key={node.id} transform={`translate(${point.x} ${point.y})`}>
              <MotionMark
                reduceMotion={reduceMotion}
                index={index}
                className="cp-constellation-node"
                data-kind="result"
                data-relation={node.relation}
                data-active={activeId === node.id ? 'true' : undefined}
                tabIndex={0}
                role="button"
                aria-label={nodeAnnotation(node, Boolean(onExpandNode))}
                aria-describedby={`${domId}-a-${node.id}`}
                data-expandable={onExpandNode ? 'true' : undefined}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId((current) => (current === node.id ? null : current))}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId((current) => (current === node.id ? null : current))}
                onClick={() => openResult(node)}
                onDoubleClick={(event) => {
                  if (!onExpandNode) return;
                  // The double click already fired one open; expanding is the
                  // second gesture and must not also navigate.
                  event.preventDefault();
                  event.stopPropagation();
                  expandNode(node);
                }}
                onKeyDown={(event) => {
                  if (onExpandNode && (event.key === 'e' || event.key === 'E')) {
                    event.preventDefault();
                    expandNode(node);
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openResult(node);
                  }
                }}
              >
                <rect
                  x={-RESULT_HALF_WIDTH}
                  y={-RESULT_HALF_HEIGHT}
                  width={RESULT_HALF_WIDTH * 2}
                  height={RESULT_HALF_HEIGHT * 2}
                  rx={10}
                  className="cp-constellation-node-shape"
                />
                {node.favicon && (
                  <image
                    href={node.favicon}
                    x={-RESULT_HALF_WIDTH + 12}
                    y={-RESULT_HALF_HEIGHT + 12}
                    width={14}
                    height={14}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
                <text className="cp-constellation-node-title" x={-RESULT_HALF_WIDTH + 32} y={-RESULT_HALF_HEIGHT + 23}>
                  {truncate(node.title, 24)}
                </text>
                <text className="cp-constellation-node-line" x={-RESULT_HALF_WIDTH + 12} y={RESULT_HALF_HEIGHT - 16}>
                  {truncate(node.description ?? hostOf(node.url), 32)}
                </text>
              </MotionMark>
              </g>
            );
          })}

          {payload.memoryNodes.map((node, index) => {
            const point = layout.get(node.id);
            if (!point) return null;
            return (
              <g key={node.id} transform={`translate(${point.x} ${point.y})`}>
              <MotionMark
                reduceMotion={reduceMotion}
                index={payload.nodes.length + index}
                className="cp-constellation-node cp-constellation-memory"
                data-kind="memory"
                data-active={activeId === node.id ? 'true' : undefined}
                tabIndex={0}
                role="button"
                aria-label={memoryAnnotation(node)}
                aria-describedby={`${domId}-a-${node.id}`}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId((current) => (current === node.id ? null : current))}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId((current) => (current === node.id ? null : current))}
                onClick={() => openMemory(node)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openMemory(node);
                  }
                }}
              >
                {/* Hexagon, deliberately not the result rectangle. */}
                <path d={hexagonPath(MEMORY_HALF_WIDTH, MEMORY_HALF_HEIGHT)} className="cp-constellation-memory-shape" />
                <text className="cp-constellation-node-title" x={0} y={-4} textAnchor="middle">
                  {truncate(node.title, 20)}
                </text>
                <text className="cp-constellation-node-line" x={0} y={14} textAnchor="middle">
                  Memory
                </text>
              </MotionMark>
              </g>
            );
          })}
        </g>

        {activeCallout && (
          <g className="cp-constellation-callout" aria-hidden="true">
            <line
              x1={activeCallout.anchor.x}
              y1={activeCallout.anchor.y}
              x2={activeCallout.box.x}
              y2={activeCallout.box.y}
            />
            {activeCallout.lines.map((line, index) => (
              <text
                key={line + index}
                x={activeCallout.box.x + 6}
                y={activeCallout.box.y + index * 13}
                textAnchor={activeCallout.anchorEnd ? 'end' : 'start'}
              >
                {line}
              </text>
            ))}
          </g>
        )}
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
  domId: string;
  payload: ConstellationPayload;
  degradedNotes: readonly string[];
  activeId: string | null;
  onActivate: (id: string | null) => void;
}) {
  return (
    <div className="cp-constellation-annotations">
      <h4 className="cp-constellation-annotations-title">Why these, and why connected</h4>

      <ul className="cp-constellation-annotation-list" aria-label="Nodes">
        {payload.nodes.map((node) => (
          <li
            key={node.id}
            id={`${domId}-a-${node.id}`}
            className="cp-constellation-annotation"
            data-active={activeId === node.id ? 'true' : undefined}
            onMouseEnter={() => onActivate(node.id)}
            onMouseLeave={() => onActivate(null)}
          >
            <span className="cp-constellation-annotation-mark">{node.admittedRank}</span>
            <span>
              <strong>{node.title}</strong>
              <em>{relationSentence(node.relation)}</em>
              {node.description && <span>{node.description}</span>}
            </span>
          </li>
        ))}
        {payload.memoryNodes.map((node) => (
          <li
            key={node.id}
            id={`${domId}-a-${node.id}`}
            className="cp-constellation-annotation cp-constellation-annotation-memory"
            data-active={activeId === node.id ? 'true' : undefined}
            onMouseEnter={() => onActivate(node.id)}
            onMouseLeave={() => onActivate(null)}
          >
            <span className="cp-constellation-annotation-mark">M</span>
            <span>
              <strong>{node.title}</strong>
              <span>{node.connectionExplanation}</span>
            </span>
          </li>
        ))}
      </ul>

      <ul className="cp-constellation-annotation-list" aria-label="Connections">
        {payload.edges.length === 0 && (
          <li className="cp-constellation-annotation cp-constellation-annotation-quiet">
            No connection survived the evidence test. These results stand apart.
          </li>
        )}
        {payload.edges.map((edge) => {
          const id = edgeKey(edge);
          return (
            <li
              key={id}
              id={`${domId}-a-${id}`}
              className="cp-constellation-annotation"
              data-reason={edge.reason.type}
              data-active={activeId === id ? 'true' : undefined}
              onMouseEnter={() => onActivate(id)}
              onMouseLeave={() => onActivate(null)}
            >
              <span className="cp-constellation-annotation-mark">{reasonMark(edge)}</span>
              <span>
                <strong>{reasonLabel(edge.reason.type)}</strong>
                <span>{edge.reason.text}</span>
                <em>Evidence: {edge.reason.evidenceRefs.join(', ')}</em>
              </span>
            </li>
          );
        })}
      </ul>

      {degradedNotes.length > 0 && (
        <ul className="cp-constellation-annotation-list cp-constellation-degraded" aria-label="Degraded providers">
          {degradedNotes.map((note) => (
            <li key={note} className="cp-constellation-annotation">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The other three states
// ---------------------------------------------------------------------------

function LoadingLadder({ narration }: { narration?: string }) {
  const [pastT1, setPastT1] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPastT1(true), CONSTELLATION_T1_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="cp-constellation-wait" data-rung={pastT1 ? 'narration' : 't1'}>
      <p className="cp-constellation-wait-micro">Admitting results</p>
      {pastT1 && (
        <p className="cp-constellation-wait-narration">
          {narration ?? 'Widening the scope and testing each candidate against the membrane.'}
        </p>
      )}
    </div>
  );
}

function EmptyState({
  reason,
  onEditQuery,
}: {
  reason: string;
  onEditQuery?: (query: string) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="cp-constellation-empty">
      <p className="cp-constellation-empty-reason">{reason}</p>
      <p className="cp-constellation-empty-help">
        Nothing was admitted, so there is no constellation to draw. Edit the query, or read the
        plain list of everything the lanes saw.
      </p>
      <form
        className="cp-constellation-empty-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (onEditQuery) onEditQuery(draft);
          else emitConstellationEvent('commonplace:constellation-edit-query', { query: draft });
        }}
      >
        <label htmlFor="cp-constellation-query">Edit query</label>
        <input
          id="cp-constellation-query"
          name="query"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Search again</button>
      </form>
    </div>
  );
}

function ErrorState({ cause, onRetry }: { cause: string; onRetry?: () => void }) {
  return (
    <div className="cp-constellation-error" role="alert">
      <p className="cp-constellation-error-cause">{cause}</p>
      <button
        type="button"
        onClick={() => {
          if (onRetry) onRetry();
          else emitConstellationEvent('commonplace:constellation-retry', {});
        }}
      >
        Retry
      </button>
    </div>
  );
}

function PlainListPending() {
  return (
    <p className="cp-constellation-list-empty">
      The plain list is supplied by the host through the list slot. This surface has nothing of its
      own to show here.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Layout wiring
// ---------------------------------------------------------------------------

/**
 * Runs the seeded layout and pins whatever was already on screen, so results
 * streaming in from the membrane join a graph that does not reshuffle.
 */
function useConstellationLayout(
  query: string,
  nodes: readonly ConstellationLayoutNode[],
  edges: readonly ConstellationLayoutEdge[],
): ConstellationLayout {
  const signature = `${query}|${nodes.map((node) => node.id).join(',')}`;
  const solve = (placed?: ReadonlyMap<string, ConstellationPoint>) =>
    layoutConstellation({ query, nodes, edges, width: VIEW_WIDTH, height: VIEW_HEIGHT, placed });

  // Adjusting state while rendering, the documented React pattern for deriving
  // a new value from the previous one when props change. The previous layout is
  // the pin set, which is what keeps placed nodes still.
  const [solved, setSolved] = useState(() => ({ signature, layout: solve() }));
  if (solved.signature === signature) return solved.layout;

  const placed = new Map<string, ConstellationPoint>();
  for (const node of nodes) {
    const point = solved.layout.get(node.id);
    if (point) placed.set(node.id, point);
  }
  const layout = solve(placed);
  setSolved({ signature, layout });
  return layout;
}

// `values` is dropped because SVG spells it as a string while motion spells it
// as a MotionValue map; the drag and animation handlers collide the same way.
type MarkAttributes = Omit<
  SVGProps<SVGGElement>,
  'onDrag' | 'onDragEnd' | 'onDragStart' | 'onAnimationStart' | 'onAnimationEnd' | 'ref' | 'values'
> & { [key: `data-${string}`]: string | undefined };

interface MotionMarkProps extends MarkAttributes {
  reduceMotion: boolean | null;
  index: number;
  children: ReactNode;
}

/**
 * One entrance vocabulary for every mark: rise and fade, staggered by index.
 * Under reduced motion the mark renders settled and static, with no entrance,
 * so the graph is legible on the first frame.
 *
 * Position never rides on this element. Result nodes are translated by an outer
 * `<g transform>` so the motion transform cannot fight the layout transform.
 */
function MotionMark({ reduceMotion, index, children, ...rest }: MotionMarkProps) {
  if (reduceMotion) {
    return <g {...rest}>{children}</g>;
  }
  return (
    <motion.g
      {...rest}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.g>
  );
}

// ---------------------------------------------------------------------------
// Annotation text
// ---------------------------------------------------------------------------

export function nodeAnnotation(node: ConstellationNode, expandable = false): string {
  const parts = [
    `Result ${node.admittedRank}: ${node.title}`,
    node.description,
    relationSentence(node.relation),
    hostOf(node.url),
    // Advertised only when the host actually wired the gesture, so the name
    // never promises an affordance the surface does not have.
    expandable ? 'Double click or press E to expand this node' : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.join('. ');
}

export function memoryAnnotation(node: ConstellationMemoryNode): string {
  return `Memory node: ${node.title}. ${node.connectionExplanation}. Opens the memory atom ${node.atomRef}`;
}

export function edgeAnnotation(edge: ConstellationEdge): string {
  return `${reasonLabel(edge.reason.type)} between ${edge.source} and ${edge.target}. ${edge.reason.text} Evidence: ${edge.reason.evidenceRefs.join(', ')}`;
}

function relationSentence(relation: ConstellationNode['relation']): string {
  switch (relation) {
    case 'known':
      return 'You already know this';
    case 'extends':
      return 'This extends what you know';
    case 'contradicts':
      return 'This contradicts what you know';
    default:
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
    default:
      return 'Exact tier memory match';
  }
}

function reasonMark(edge: ConstellationEdge): string {
  return reasonLabel(edge.reason.type).charAt(0);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

interface Callout {
  anchor: ConstellationPoint;
  box: ConstellationPoint;
  lines: string[];
  anchorEnd: boolean;
}

function calloutFor(
  activeId: string | null,
  payload: ConstellationPayload,
  layout: ConstellationLayout,
  memoryById: ReadonlyMap<string, ConstellationMemoryNode>,
): Callout | undefined {
  if (!activeId) return undefined;

  const node = payload.nodes.find((candidate) => candidate.id === activeId);
  if (node) {
    const point = layout.get(node.id);
    return point ? buildCallout(point, nodeAnnotation(node)) : undefined;
  }

  const memory = memoryById.get(activeId);
  if (memory) {
    const point = layout.get(memory.id);
    return point ? buildCallout(point, memory.connectionExplanation) : undefined;
  }

  const edge = payload.edges.find((candidate) => edgeKey(candidate) === activeId);
  if (!edge) return undefined;
  const from = layout.get(edge.source);
  const to = layout.get(edge.target);
  if (!from || !to) return undefined;
  return buildCallout({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, edge.reason.text);
}

function buildCallout(anchor: ConstellationPoint, text: string): Callout {
  const toLeft = anchor.x > VIEW_WIDTH / 2;
  const box = {
    x: clamp(anchor.x + (toLeft ? -CONSTELLATION_NODE_RADIUS : CONSTELLATION_NODE_RADIUS), 16, VIEW_WIDTH - 16),
    y: clamp(anchor.y - CONSTELLATION_MEMORY_RADIUS, 26, VIEW_HEIGHT - 44),
  };
  return { anchor, box, lines: wrap(text, 38, 3), anchorEnd: toLeft };
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

function edgeKey(edge: ConstellationEdge): string {
  return `${edge.source}-${edge.target}-${edge.reason.type}`;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1)).trimEnd()}...`;
}

function wrap(text: string, columns: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > columns && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}...`;
  }
  return lines;
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].replace(/^www\./, '') : url;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function emitConstellationEvent(name: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

/** Kept so the stylesheet and the renderer agree on the drawing box. */
export const CONSTELLATION_VIEWBOX: CSSProperties = {
  aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}`,
};
