'use client';

// Installed source: https://21st.dev/r/moazamtrade/3d-image-gallery
// Upstream component: 21st catalog entry 6525, "3D Image Gallery" by moazamtrade.
// The upstream CardProvider, FloatingCard, CardGalaxy, camera, lighting,
// sphere radii, golden-ratio positions, and OrbitControls are retained.
// CommonPlace customizes data injection, tokenized material, a transparent
// scene shell that defers ambient ground to MaterialLayer (Paper-designed
// anatomy, Spec 34), bounded sizing, accessibility, and receipts.

import {
  Suspense,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  Canvas,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber';
import {
  Billboard,
  Environment,
  Html,
  OrbitControls,
  Plane,
  Sphere,
} from '@react-three/drei';

export interface StellarGalleryCard {
  readonly id: string;
  readonly alt: string;
  readonly title: string;
}

export interface StellarCardPosition {
  readonly cardId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
}

export interface StellarGalleryPalette {
  readonly ground: string;
  readonly graph: string;
  readonly gold: string;
  readonly ink: string;
}

export interface StellarGalleryMetrics {
  readonly calls: number;
  readonly triangles: number;
  readonly textures: number;
}

/** Relationship focus for the corpus: idle is quiet; hover reveals neighborhood. */
export type StellarCardFocus = 'idle' | 'focused' | 'related' | 'dimmed';

export interface StellarCardRenderState {
  readonly hovered: boolean;
  readonly focus: StellarCardFocus;
}

interface CardContextType {
  readonly cards: readonly StellarGalleryCard[];
  readonly onSelect: (card: StellarGalleryCard) => void;
  readonly renderCard: (card: StellarGalleryCard, state: StellarCardRenderState) => ReactNode;
  readonly hoveredCardId: string | null;
  readonly setCardHovered: (cardId: string, hovered: boolean) => void;
  readonly adjacency: ReadonlyMap<string, ReadonlySet<string>>;
}

const CardContext = createContext<CardContextType | null>(null);

function useCard() {
  const context = useContext(CardContext);
  if (!context) throw new Error('useCard must be used within CardProvider');
  return context;
}

export function resolveCardFocus(
  cardId: string,
  hoveredCardId: string | null,
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): StellarCardFocus {
  if (hoveredCardId === null) return 'idle';
  if (cardId === hoveredCardId) return 'focused';
  if (adjacency.get(hoveredCardId)?.has(cardId)) return 'related';
  return 'dimmed';
}

function CardProvider({
  cards,
  onSelect,
  renderCard,
  adjacency,
  children,
}: Pick<CardContextType, 'cards' | 'onSelect' | 'renderCard' | 'adjacency'> & {
  readonly children: ReactNode;
}) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const setCardHovered = useCallback((cardId: string, hovered: boolean) => {
    setHoveredCardId((current) => {
      if (hovered) return cardId;
      return current === cardId ? null : current;
    });
  }, []);
  const value = useMemo(() => ({
    cards,
    onSelect,
    renderCard,
    hoveredCardId,
    setCardHovered,
    adjacency,
  }), [adjacency, cards, hoveredCardId, onSelect, renderCard, setCardHovered]);
  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

function MaterialGround() {
  // MaterialLayer paints the ambient frame and island body. This slot stays
  // transparent so the Paper-shader grammar shows through the R3F scene.
  return <div className="stellar-gallery-ground absolute inset-0 z-0" aria-hidden="true" />;
}

export const STELLAR_CARD_SIZE = { width: 6, height: 4.5 } as const;

function FloatingCard({
  card,
  position,
}: {
  readonly card: StellarGalleryCard;
  readonly position: StellarCardPosition;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { onSelect, renderCard, setCardHovered, hoveredCardId, adjacency } = useCard();
  const { invalidate } = useThree();
  const size = STELLAR_CARD_SIZE;
  const focus = resolveCardFocus(card.id, hoveredCardId, adjacency);

  const handleFrameMount = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    invalidate();
    requestAnimationFrame(() => invalidate());
  }, [invalidate]);

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    invalidate();
  }, [focus, invalidate]);

  const handleHovered = (nextHovered: boolean) => {
    setHovered(nextHovered);
    setCardHovered(card.id, nextHovered);
    document.body.style.cursor = nextHovered ? 'pointer' : '';
    invalidate();
  };

  return (
    <group position={[position.x, position.y, position.z]}>
      <Billboard follow>
        <Plane
          ref={meshRef}
          args={[size.width, size.height]}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            onSelect(card);
          }}
          onPointerOver={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            handleHovered(true);
          }}
          onPointerOut={(event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            handleHovered(false);
          }}
        >
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </Plane>
      </Billboard>

      <Html
        transform
        sprite
        distanceFactor={10}
        position={[0, 0, 0.01]}
        pointerEvents="none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={handleFrameMount}
          className="stellar-gallery-card-frame select-none"
          data-world-x={position.x}
          data-world-y={position.y}
          data-world-z={position.z}
          data-card-focus={focus}
          style={{
            width: `${size.width * 40}px`,
            height: `${size.height * 40}px`,
          }}
        >
          {renderCard(card, { hovered, focus })}
        </div>
      </Html>
    </group>
  );
}

export function createStellarCardPositions(
  cards: readonly StellarGalleryCard[],
): readonly StellarCardPosition[] {
  const denominator = Math.max(1, cards.length - 1);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  return cards.map((card, index) => {
    const y = 1 - (index / denominator) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = (2 * Math.PI * index) / goldenRatio;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;
    const layerRadius = 12 + (index % 3) * 4;
    return {
      cardId: card.id,
      x: x * layerRadius,
      y: y * layerRadius,
      z: z * layerRadius,
      rotationX: Math.atan2(z, Math.sqrt(x * x + y * y)),
      rotationY: Math.atan2(x, z),
      rotationZ: ((index * 37) % 20 - 10) / 100,
    };
  });
}

function CardGalaxy({
  palette,
  positions,
  sceneExtras,
}: {
  readonly palette: StellarGalleryPalette;
  readonly positions: readonly StellarCardPosition[];
  readonly sceneExtras?: (
    positions: readonly StellarCardPosition[],
    hoveredCardId: string | null,
  ) => ReactNode;
}) {
  const { cards, hoveredCardId } = useCard();
  return (
    <>
      <Sphere args={[2, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color={palette.ground} transparent opacity={0.15} wireframe />
      </Sphere>
      <Sphere args={[12, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color={palette.graph} transparent opacity={0.05} wireframe />
      </Sphere>
      <Sphere args={[16, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color={palette.graph} transparent opacity={0.03} wireframe />
      </Sphere>
      <Sphere args={[20, 32, 32]} position={[0, 0, 0]}>
        <meshStandardMaterial color={palette.graph} transparent opacity={0.02} wireframe />
      </Sphere>

      {sceneExtras?.(positions, hoveredCardId)}
      {cards.map((card, index) => {
        const position = positions[index];
        return position ? <FloatingCard key={card.id} card={card} position={position} /> : null;
      })}
    </>
  );
}

function CameraControls({
  distance,
  resetKey,
}: {
  readonly distance: number;
  readonly resetKey: number;
}) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  }, [camera, distance, resetKey]);

  return (
    <OrbitControls
      ref={controlsRef}
      // Wheel zooms toward the corpus center; pan is secondary to depth travel.
      enablePan
      enableZoom
      enableRotate
      minDistance={5}
      maxDistance={Math.max(40, distance)}
      autoRotate={false}
      rotateSpeed={0.5}
      zoomSpeed={1.35}
      panSpeed={0.55}
      target={[0, 0, 0]}
      zoomToCursor={false}
      makeDefault
    />
  );
}

function SceneRuntime({
  onContextLost,
  onMetrics,
}: {
  readonly onContextLost?: () => void;
  readonly onMetrics?: (metrics: StellarGalleryMetrics) => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost?.();
    };
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onContextLost]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        onMetrics?.({
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          textures: gl.info.memory.textures,
        });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [gl, onMetrics]);

  return null;
}

const EMPTY_ADJACENCY: ReadonlyMap<string, ReadonlySet<string>> = new Map();

export default function StellarCardGallerySingle({
  cards,
  palette,
  cameraDistance = 15,
  resetKey = 0,
  ariaLabel = 'Three dimensional gallery. Drag to look around, scroll to zoom toward the center, and select a card to inspect it.',
  renderCard,
  onSelect,
  adjacency = EMPTY_ADJACENCY,
  sceneExtras,
  onContextLost,
  onMetrics,
}: {
  readonly cards: readonly StellarGalleryCard[];
  readonly palette: StellarGalleryPalette;
  readonly cameraDistance?: number;
  readonly resetKey?: number;
  readonly ariaLabel?: string;
  readonly renderCard: (card: StellarGalleryCard, state: StellarCardRenderState) => ReactNode;
  readonly onSelect: (card: StellarGalleryCard) => void;
  readonly adjacency?: ReadonlyMap<string, ReadonlySet<string>>;
  readonly sceneExtras?: (
    positions: readonly StellarCardPosition[],
    hoveredCardId: string | null,
  ) => ReactNode;
  readonly onContextLost?: () => void;
  readonly onMetrics?: (metrics: StellarGalleryMetrics) => void;
}) {
  const positions = useMemo(() => createStellarCardPositions(cards), [cards]);
  const [scenePrimed, setScenePrimed] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setScenePrimed(true), 350);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <CardProvider cards={cards} onSelect={onSelect} renderCard={renderCard} adjacency={adjacency}>
      <div className="stellar-gallery relative h-full w-full overflow-hidden">
        <MaterialGround />

        <Canvas
          role="application"
          aria-label={ariaLabel}
          camera={{ position: [0, 0, cameraDistance], fov: 60 }}
          className="absolute inset-0 z-10"
          dpr={[1, 1.5]}
          frameloop={scenePrimed ? 'demand' : 'always'}
          gl={{ alpha: true, antialias: true, premultipliedAlpha: true }}
          fallback={<div className="h-full w-full" />}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.domElement.style.pointerEvents = 'auto';
            gl.domElement.style.touchAction = 'none';
            gl.domElement.style.background = 'transparent';
          }}
        >
          <Suspense fallback={null}>
            <Environment preset="night" />
          </Suspense>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={0.6} />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          <SceneRuntime onContextLost={onContextLost} onMetrics={onMetrics} />
          <CardGalaxy palette={palette} positions={positions} sceneExtras={sceneExtras} />
          <CameraControls distance={cameraDistance} resetKey={resetKey} />
        </Canvas>
      </div>
    </CardProvider>
  );
}
