'use client';

// SOURCING: @commonplace/block-view for typed captures, and a lazy
// @react-three/fiber plus @react-three/drei scene for spatial navigation.
// Source pixels and source-shaped reconstructions live in SurveySourceArtifact,
// outside the CommonPlace annotation layer.

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import type { ViewRenderProps } from '@commonplace/block-view/types';
import { useMotionDurations } from '@/motion/motion-tokens';
import { ViewState } from './ViewStates';
import {
  budgetSurveyEdges,
  surveyModelFromObjects,
  type SurveyCapture,
  type SurveyCluster,
  type SurveyEdge,
} from './survey/surveyContract';
import {
  SurveySourceArtifact,
  SurveySourceCard,
} from './survey/SurveySourceArtifact';
import type {
  SurveySceneMetrics,
  SurveyScenePalette,
} from './survey/SurveyScene3D';

const SurveyScene3D = dynamic(
  () => import('./survey/SurveyScene3D').then((module) => module.SurveyScene3D),
  {
    ssr: false,
    loading: () => (
      <div data-survey-scene-loading className="flex h-full items-center justify-center text-sm text-ij-ink">
        Preparing spatial captures
      </div>
    ),
  },
);

type SurveyZoom = 'far' | 'mid';

const INDEXER_CAMERA_DISTANCE: Readonly<Record<SurveyZoom, number>> = {
  far: 48,
  mid: 15,
};

interface SourceFrameStyle extends CSSProperties {
  '--survey-source-aspect': string;
}

class SurveySceneBoundary extends Component<
  { readonly children: ReactNode; readonly fallback: ReactNode; readonly onError: () => void },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useSurfaceCapabilities(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [palette, setPalette] = useState<SurveyScenePalette | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    const canvas = document.createElement('canvas');
    setWebgl(Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl')));
    const styles = getComputedStyle(element);
    const nextPalette = {
      ground: styles.getPropertyValue('--ij-editor').trim(),
      graph: styles.getPropertyValue('--ij-graph').trim(),
      gold: styles.getPropertyValue('--ij-gold').trim(),
      ink: styles.getPropertyValue('--ij-ink').trim(),
    };
    if (nextPalette.ground && nextPalette.graph && nextPalette.gold && nextPalette.ink) {
      setPalette(nextPalette);
    }
    return () => observer.disconnect();
  }, [ref]);

  return { width, webgl, palette };
}

function FlatSurvey({
  clusters,
  captures,
  edges,
  topicTitle,
  onOpen,
}: {
  readonly clusters: readonly SurveyCluster[];
  readonly captures: readonly SurveyCapture[];
  readonly edges: readonly SurveyEdge[];
  readonly topicTitle: string;
  readonly onOpen: (capture: SurveyCapture) => void;
}) {
  return (
    <div data-survey-layout="flat" className="h-full overflow-y-auto p-6">
      <div className="survey-flat-grid items-start">
        <SurveyConnectionList captures={captures} edges={edges} />
        {clusters.flatMap((cluster) => [
          <h2
            key={`${cluster.id}-label`}
            className="col-span-full mt-2 border-b border-ij-seam pb-2 text-xs uppercase tracking-wider text-ij-gold"
          >
            {cluster.label} · {cluster.captures.length}
          </h2>,
          ...cluster.captures.map((capture) => (
            <SurveySourceCard
              key={capture.id}
              capture={capture}
              topicTitle={topicTitle}
              onOpen={() => onOpen(capture)}
            />
          )),
        ])}
      </div>
    </div>
  );
}

function SurveyConnectionList({
  captures,
  edges,
}: {
  readonly captures: readonly SurveyCapture[];
  readonly edges: readonly SurveyEdge[];
}) {
  const titles = new Map(captures.map((capture) => [capture.id, capture.title]));
  return (
    <section
      data-survey-connections
      className="col-span-full rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-3 text-xs text-ij-ink"
      aria-labelledby="survey-connections-heading"
    >
      <h2 id="survey-connections-heading" className="uppercase tracking-wider text-ij-gold">
        Directed connections · {edges.length}
      </h2>
      <ul className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {edges.map((edge) => (
          <li key={edge.id} className="rounded-ij-arc-underline border border-ij-seam p-2">
            <p className="truncate font-ij-mono text-ij-ink">
              {titles.get(edge.from) ?? edge.from} → {titles.get(edge.to) ?? edge.to}
            </p>
            <p className="mt-1 text-ij-ink">{edge.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CaptureReadingView({
  capture,
  captures,
  edges,
  onBack,
  onOpenRelated,
}: {
  readonly capture: SurveyCapture;
  readonly captures: readonly SurveyCapture[];
  readonly edges: readonly SurveyEdge[];
  readonly onBack: () => void;
  readonly onOpenRelated: (capture: SurveyCapture) => void;
}) {
  const sourceStyle: SourceFrameStyle = { '--survey-source-aspect': String(capture.sourceAspectRatio) };
  const titles = new Map(captures.map((item) => [item.id, item.title]));
  const related = edges
    .filter((edge) => edge.from === capture.id || edge.to === capture.id)
    .map((edge) => {
      const otherId = edge.from === capture.id ? edge.to : edge.from;
      return {
        edge,
        otherId,
        title: titles.get(otherId) ?? otherId,
        direction: edge.from === capture.id ? 'out' as const : 'in' as const,
      };
    });

  return (
    <div data-survey-layout="open" className="flex h-full min-h-0">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-ij-toolbar items-center gap-3 border-b border-ij-seam bg-ij-chrome px-3">
          <button
            type="button"
            onClick={onBack}
            className="survey-focusable h-ij-control rounded-ij-arc px-3 text-ij-ink hover:bg-ij-hover-surface"
          >
            Back to Indexer
          </button>
          <span className="truncate text-ij-ink">{capture.title}</span>
          {capture.sourceUrl ? (
            <a
              href={capture.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="survey-focusable ml-auto rounded-ij-arc px-2 py-1 text-ij-link hover:bg-ij-hover-surface"
            >
              Original source
            </a>
          ) : null}
        </div>
        <div className="survey-open-source mx-auto p-8">
          <div
            className="survey-open-source-frame overflow-hidden rounded-ij-arc border border-ij-seam-raised"
            style={sourceStyle}
          >
            <SurveySourceArtifact capture={capture} />
          </div>
        </div>
      </main>
      <aside className="survey-open-rail overflow-y-auto border-l border-ij-seam bg-ij-chrome p-4">
        <p className="text-xs uppercase tracking-wider text-ij-ink">Annotations</p>
        <dl className="survey-metadata-grid mt-3 gap-x-3 gap-y-2 text-xs">
          <dt className="text-ij-ink">Source</dt><dd className="truncate text-ij-ink">{capture.domain}</dd>
          <dt className="text-ij-ink">Type</dt><dd className="text-ij-ink">{capture.kind}</dd>
          <dt className="text-ij-ink">Captured</dt><dd className="font-ij-mono text-ij-ink">{capture.capturedAt}</dd>
          <dt className="text-ij-ink">Form</dt><dd className="font-ij-mono text-ij-ink">{capture.sourceKind}</dd>
          {capture.sourcePreviewKind ? (
            <>
              <dt className="text-ij-ink">Preview</dt>
              <dd className="font-ij-mono text-ij-ink">
                {capture.sourcePreviewKind.replace('_', ' ')} · held
              </dd>
            </>
          ) : null}
        </dl>
        <section className="mt-6 border-t border-ij-seam pt-4">
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">Data Wave tags</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {capture.tags.map((tag) => (
              <li key={tag} className="rounded-ij-arc-underline bg-ij-gold-tint px-2 py-1 text-xs text-ij-gold">{tag}</li>
            ))}
          </ul>
        </section>
        <section className="mt-6 border-t border-ij-seam pt-4">
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">Matched evidence</h2>
          <ul className="mt-2 space-y-3">
            {capture.matchedSpans.map((span) => (
              <li key={`${span.start}-${span.end}`} className="border-l-2 border-ij-gold pl-3 text-xs">
                <mark className="bg-ij-gold-tint text-ij-gold">{capture.excerpt.slice(span.start, span.end)}</mark>
                <p className="mt-1 text-ij-ink">{span.feature} · {span.attribution}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 border-t border-ij-seam pt-4">
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">Orgs and entities</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {capture.entities.map((entity) => (
              <li key={entity} className="rounded-ij-arc-underline bg-ij-selection px-2 py-1 text-xs text-ij-ink">{entity}</li>
            ))}
          </ul>
        </section>
        <section className="mt-6 border-t border-ij-seam pt-4">
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">People and mentions</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {capture.mentions.map((mention) => (
              <li key={mention} className="rounded-ij-arc-underline bg-ij-selection px-2 py-1 text-xs text-ij-ink">{mention}</li>
            ))}
          </ul>
        </section>
        <section className="mt-6 border-t border-ij-seam pt-4" data-survey-related>
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">
            Remembered connections · {related.length}
          </h2>
          <ul className="mt-2 space-y-2">
            {related.map(({ edge, otherId, title, direction }) => (
              <li key={edge.id} className="rounded-ij-arc-underline border border-ij-seam p-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const next = captures.find((item) => item.id === otherId);
                    if (next) onOpenRelated(next);
                  }}
                  className="survey-focusable w-full text-left text-ij-ink hover:bg-ij-hover-surface"
                >
                  <span className="font-ij-mono text-ij-gold">{direction === 'out' ? 'to' : 'from'}</span>
                  <span className="ml-2 truncate">{title}</span>
                </button>
                <p className="mt-1 text-ij-ink">{edge.reason}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-6 border-t border-ij-seam pt-4">
          <h2 className="text-xs uppercase tracking-wider text-ij-ink">Action</h2>
          <button
            type="button"
            disabled
            title="The card action runner is not connected in this Console slice"
            className="mt-2 h-ij-control w-full rounded-ij-arc border border-ij-control-border text-ij-ink-disabled"
          >
            /do follow-up
          </button>
          <p className="mt-2 text-xs text-ij-ink">Action context is carried; execution waits for the card runner.</p>
        </section>
      </aside>
    </div>
  );
}

function SurveySourceNavigator({
  captures,
  onOpen,
}: {
  readonly captures: readonly SurveyCapture[];
  readonly onOpen: (capture: SurveyCapture) => void;
}) {
  return (
    <details className="survey-source-navigator relative">
      <summary className="survey-focusable flex h-ij-control cursor-pointer list-none items-center rounded-ij-arc bg-ij-chrome px-3 text-xs text-ij-ink">
        Browse {captures.length} sources
      </summary>
      <ul className="survey-source-navigator-list absolute bottom-full left-0 mb-2 max-h-80 space-y-1 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-2">
        {captures.map((capture) => (
          <li key={capture.id}>
            <button
              type="button"
              onClick={() => onOpen(capture)}
              className="survey-focusable flex h-ij-control w-full items-center gap-2 rounded-ij-arc px-2 text-left text-xs text-ij-ink hover:bg-ij-hover-surface"
              aria-label={`Open captured source: ${capture.title}`}
            >
              <span className="font-ij-mono uppercase text-ij-gold">{capture.sourceKind}</span>
              <span className="truncate">{capture.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SurveyConnectionNavigator({ edges }: { readonly edges: readonly SurveyEdge[] }) {
  return (
    <details className="survey-source-navigator relative">
      <summary className="survey-focusable flex h-ij-control cursor-pointer list-none items-center rounded-ij-arc bg-ij-chrome px-3 text-xs text-ij-ink">
        Review {edges.length} connections
      </summary>
      <ul className="survey-source-navigator-list absolute bottom-full left-0 mb-2 max-h-80 space-y-2 overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-chrome p-2 text-xs text-ij-ink">
        {edges.map((edge) => (
          <li key={edge.id} className="rounded-ij-arc-underline border border-ij-seam p-2">
            {edge.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SurveyView({ set }: ViewRenderProps) {
  const durations = useMotionDurations();
  const model = useMemo(() => surveyModelFromObjects(set.objects), [set.objects]);
  const [zoom, setZoom] = useState<SurveyZoom>('far');
  const [resetKey, setResetKey] = useState(0);
  const [openCaptureId, setOpenCaptureId] = useState<string | null>(null);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [metrics, setMetrics] = useState<SurveySceneMetrics | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { width, webgl, palette } = useSurfaceCapabilities(rootRef);
  const edges = useMemo(() => budgetSurveyEdges(model.edges, 2), [model.edges]);
  const topicTitle = model.topic?.title ?? 'Standing topic';
  const constrained = width > 0 && width < 1100;
  const flat = durations.reduced || sceneFailed || webgl === false || constrained;
  const sceneReady = !flat && webgl === true && palette !== null;
  const openCapture = model.captures.find((capture) => capture.id === openCaptureId) ?? null;
  const handleFallback = useCallback(() => setSceneFailed(true), []);
  const handleMetrics = useCallback((next: SurveySceneMetrics) => {
    setMetrics((current) => (
      current?.calls === next.calls && current.triangles === next.triangles && current.textures === next.textures
        ? current
        : next
    ));
  }, []);

  if (!model.topic || model.captures.length === 0) return <ViewState state="empty" />;
  if (openCapture) {
    return (
      <CaptureReadingView
        capture={openCapture}
        captures={model.captures}
        edges={edges}
        onBack={() => setOpenCaptureId(null)}
        onOpenRelated={(next) => setOpenCaptureId(next.id)}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex h-full min-h-0 flex-col"
      data-survey
      data-indexer
      data-reduced-motion={durations.reduced ? 'true' : 'false'}
      data-scene-mode={flat ? 'flat' : sceneReady ? '3d' : 'loading'}
      data-scene-calls={metrics?.calls}
      data-scene-triangles={metrics?.triangles}
      data-scene-textures={metrics?.textures}
      data-camera-distance={INDEXER_CAMERA_DISTANCE[zoom]}
    >
      <header className="flex h-ij-toolbar shrink-0 items-center gap-3 border-b border-ij-seam bg-ij-chrome px-3">
        <div className="min-w-0">
          <h1 className="truncate text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>{topicTitle}</h1>
          <p className="truncate text-xs text-ij-ink">{model.topic.description}</p>
        </div>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Indexer camera">
          {(['far', 'mid'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={zoom === option}
              onClick={() => setZoom(option)}
              className="survey-focusable h-ij-control rounded-ij-arc px-3 capitalize text-ij-ink hover:bg-ij-hover-surface aria-pressed:bg-ij-selection"
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setResetKey((current) => current + 1)}
            className="survey-focusable h-ij-control rounded-ij-arc px-3 text-ij-ink hover:bg-ij-hover-surface"
          >
            Reset view
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {flat ? (
          <FlatSurvey
            clusters={model.clusters}
            captures={model.captures}
            edges={edges}
            topicTitle={topicTitle}
            onOpen={(capture) => setOpenCaptureId(capture.id)}
          />
        ) : sceneReady ? (
          <SurveySceneBoundary
            onError={handleFallback}
            fallback={(
              <FlatSurvey
                clusters={model.clusters}
                captures={model.captures}
                edges={edges}
                topicTitle={topicTitle}
                onOpen={(capture) => setOpenCaptureId(capture.id)}
              />
            )}
          >
            <div data-survey-layout="3d" className="relative h-full min-h-0 overflow-hidden">
              <SurveyScene3D
                captures={model.captures}
                edges={edges}
                palette={palette}
                topicTitle={topicTitle}
                cameraDistance={INDEXER_CAMERA_DISTANCE[zoom]}
                resetKey={resetKey}
                onOpen={(capture) => setOpenCaptureId(capture.id)}
                onFallback={handleFallback}
                onMetrics={handleMetrics}
              />
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                <SurveySourceNavigator captures={model.captures} onOpen={(capture) => setOpenCaptureId(capture.id)} />
                <SurveyConnectionNavigator edges={edges} />
                <div className="pointer-events-none rounded-ij-arc bg-ij-chrome px-3 py-2 text-xs text-ij-ink">
                  Drag to orbit · Scroll toward center · Hover reveals links · Select a source
                </div>
              </div>
            </div>
          </SurveySceneBoundary>
        ) : (
          <div data-survey-layout="loading" className="flex h-full items-center justify-center text-sm text-ij-ink">
            Checking Indexer rendering
          </div>
        )}
      </div>
    </div>
  );
}
