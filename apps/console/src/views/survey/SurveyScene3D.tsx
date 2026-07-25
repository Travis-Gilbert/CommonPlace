'use client';

// Direct adaptation of the installed 21st.dev 3D Image Gallery. The upstream
// component owns the golden-ratio galaxy, camera, and controls. This adapter
// injects Survey captures, relation geometry, and open behavior.

import { useCallback, useMemo, useState } from 'react';
import { Billboard, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import StellarCardGallerySingle, {
  type StellarCardPosition,
  type StellarCardRenderState,
  type StellarGalleryCard,
  type StellarGalleryMetrics,
  type StellarGalleryPalette,
} from '@/components/ui/3d-image-gallery';
import type { SurveyCapture, SurveyEdge } from './surveyContract';
import { SurveySourceCard } from './SurveySourceArtifact';

export interface SurveyScenePalette extends StellarGalleryPalette {}

export interface SurveySceneMetrics extends StellarGalleryMetrics {}

function buildAdjacency(
  edges: readonly SurveyEdge[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const adjacency = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    const neighbors = adjacency.get(from) ?? new Set<string>();
    neighbors.add(to);
    adjacency.set(from, neighbors);
  };
  for (const edge of edges) {
    link(edge.from, edge.to);
    link(edge.to, edge.from);
  }
  return adjacency;
}

function ConnectionGeometry({
  edges,
  positions,
  palette,
  hoveredCardId,
}: {
  readonly edges: readonly SurveyEdge[];
  readonly positions: readonly StellarCardPosition[];
  readonly palette: SurveyScenePalette;
  readonly hoveredCardId: string | null;
}) {
  const byId = useMemo(
    () => new Map(positions.map((position) => [position.cardId, position])),
    [positions],
  );
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);

  return (
    <>
      {edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        const midpoint: [number, number, number] = [
          (from.x + to.x) / 2,
          (from.y + to.y) / 2,
          (from.z + to.z) / 2,
        ];
        const fromPoint = new THREE.Vector3(from.x, from.y, from.z);
        const toPoint = new THREE.Vector3(to.x, to.y, to.z);
        const direction = toPoint.clone().sub(fromPoint);
        if (direction.lengthSq() === 0) return null;
        direction.normalize();
        const arrowPosition = fromPoint.clone().lerp(toPoint, 0.82);
        const arrowRotation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );
        const edgeHovered = hoveredEdgeId === edge.id;
        const edgePinned = pinnedEdgeId === edge.id;
        const cardConnected = hoveredCardId === edge.from || hoveredCardId === edge.to;
        const active = edgePinned || edgeHovered || cardConnected;
        const emphasis = edgePinned ? 'pinned' : edgeHovered ? 'hovered' : cardConnected ? 'related' : 'idle';
        const idleOpacity = hoveredCardId === null
          ? 0.08 + edge.strength * 0.05
          : 0.028;
        return (
          <group key={edge.id}>
            <Line
              points={[[from.x, from.y, from.z], [to.x, to.y, to.z]]}
              color={palette.graph}
              lineWidth={edgePinned ? 1.8 + edge.strength * 0.7 : active ? 1 + edge.strength * 0.65 : 0.45}
              transparent
              opacity={edgePinned ? 0.92 + edge.strength * 0.08 : active ? 0.58 + edge.strength * 0.32 : idleOpacity}
              onPointerOver={() => {
                setHoveredEdgeId(edge.id);
              }}
              onPointerOut={() => {
                setHoveredEdgeId((current) => current === edge.id ? null : current);
              }}
            />
            {active ? (
              <mesh position={arrowPosition} quaternion={arrowRotation}>
                <coneGeometry args={[0.14, 0.38, 12]} />
                <meshBasicMaterial
                  color={palette.graph}
                  transparent
                  opacity={edgePinned ? 1 : 0.76 + edge.strength * 0.2}
                  depthWrite={false}
                />
              </mesh>
            ) : null}
            <Billboard position={midpoint} follow>
              <mesh
                onPointerOver={(event) => {
                  event.stopPropagation();
                  setHoveredEdgeId(edge.id);
                }}
                onPointerOut={() => setHoveredEdgeId((current) => (
                  current === edge.id ? null : current
                ))}
                onClick={(event) => {
                  event.stopPropagation();
                  setPinnedEdgeId((current) => current === edge.id ? null : edge.id);
                }}
              >
                <circleGeometry args={[0.7, 16]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            </Billboard>
            <Html
              transform
              sprite
              position={midpoint}
              distanceFactor={10}
              zIndexRange={[12, 0]}
              pointerEvents="none"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="survey-edge-reason flex h-6 items-center rounded-full bg-ij-editor px-2 text-xs text-ij-ink"
                data-survey-edge-id={edge.id}
                data-edge-active={active ? 'true' : 'false'}
                data-edge-emphasis={emphasis}
                data-edge-pinned={edgePinned ? 'true' : 'false'}
                data-edge-from={edge.from}
                data-edge-to={edge.to}
                data-edge-idle-opacity={idleOpacity}
                aria-hidden="true"
                style={{ opacity: active ? 1 : 0 }}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ij-graph" />
                {active ? (
                  <span className="ml-2 max-w-64">{edge.reason}</span>
                ) : null}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export function SurveyScene3D({
  captures,
  edges,
  palette,
  topicTitle,
  cameraDistance,
  resetKey,
  onOpen,
  onFallback,
  onMetrics,
}: {
  readonly captures: readonly SurveyCapture[];
  readonly edges: readonly SurveyEdge[];
  readonly palette: SurveyScenePalette;
  readonly topicTitle: string;
  readonly cameraDistance: number;
  readonly resetKey: number;
  readonly onOpen: (capture: SurveyCapture) => void;
  readonly onFallback: () => void;
  readonly onMetrics: (metrics: SurveySceneMetrics) => void;
}) {
  const captureById = useMemo(
    () => new Map(captures.map((capture) => [capture.id, capture])),
    [captures],
  );
  const captureIds = useMemo(() => new Set(captures.map((capture) => capture.id)), [captures]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => captureIds.has(edge.from) && captureIds.has(edge.to)),
    [captureIds, edges],
  );
  const adjacency = useMemo(() => buildAdjacency(visibleEdges), [visibleEdges]);
  const cards = useMemo<readonly StellarGalleryCard[]>(() => captures.map((capture) => ({
    id: capture.id,
    alt: capture.sourceSnapshotAlt ?? capture.title,
    title: capture.title,
  })), [captures]);
  const handleSelect = useCallback((card: StellarGalleryCard) => {
    const capture = captureById.get(card.id);
    if (capture) onOpen(capture);
  }, [captureById, onOpen]);

  const renderCard = useCallback((card: StellarGalleryCard, state: StellarCardRenderState) => {
    const capture = captureById.get(card.id);
    if (!capture) return null;
    return (
      <SurveySourceCard
        capture={capture}
        topicTitle={topicTitle}
        spatial
        hovered={state.hovered}
        focus={state.focus}
        onOpen={() => onOpen(capture)}
      />
    );
  }, [captureById, onOpen, topicTitle]);

  const renderConnections = useCallback((
    positions: readonly StellarCardPosition[],
    hoveredCardId: string | null,
  ) => (
    <ConnectionGeometry
      edges={visibleEdges}
      positions={positions}
      palette={palette}
      hoveredCardId={hoveredCardId}
    />
  ), [palette, visibleEdges]);

  return (
    <StellarCardGallerySingle
      cards={cards}
      palette={palette}
      cameraDistance={cameraDistance}
      resetKey={resetKey}
      ariaLabel="Three dimensional Indexer. Drag to inspect the topic, scroll to zoom toward the center, and select a source to open it."
      renderCard={renderCard}
      onSelect={handleSelect}
      adjacency={adjacency}
      sceneExtras={renderConnections}
      onContextLost={onFallback}
      onMetrics={onMetrics}
    />
  );
}
