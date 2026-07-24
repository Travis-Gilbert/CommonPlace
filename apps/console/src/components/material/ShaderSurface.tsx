// SOURCING: @paper-design/shaders ShaderMount (vanilla). Owns canvas + getContext
// in-file for SPEC-MATERIAL-REGISTER-1.0 D6 / motion gate. Mounts the Paper
// fragment named by the material map (dot-grid, paper-texture, dithering,
// fluted-glass) plus grain-gradient for streaming directional flow.

'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ShaderMount,
  dotGridFragmentShader,
  DotGridShapes,
  type DotGridShape,
  paperTextureFragmentShader,
  ditheringFragmentShader,
  DitheringShapes,
  DitheringTypes,
  flutedGlassFragmentShader,
  GlassDistortionShapes,
  GlassGridShapes,
  grainGradientFragmentShader,
  GrainGradientShapes,
  getShaderColorFromString,
  getShaderNoiseTexture,
  emptyPixel,
  defaultObjectSizing,
  defaultPatternSizing,
  ShaderFitOptions,
  type ShaderMountUniforms,
} from '@paper-design/shaders';
import { useMotionDurations } from '@/motion/motion-tokens';
import { resolveMaterial, type MaterialState } from '@/lib/material/materials';

const LIVE_MOUNTS = new Set<object>();
/** Hard cap: browsers allow few live WebGL contexts (named choice 6). */
export const SHADER_CONTEXT_BUDGET = 4;

/** Optional override when a surface needs a Paper fragment the material map
 *  does not name (composer streaming uses grain-gradient for directional flow). */
export type PaperShaderOverride =
  | 'dot-grid'
  | 'paper-texture'
  | 'dithering'
  | 'fluted-glass'
  | 'grain-gradient';

export type PaperSurfaceParams = {
  /** PaperTexture roughness / fiber scale (0 to 1). */
  readonly roughness?: number;
  readonly fiber?: number;
  readonly fiberSize?: number;
  readonly crumples?: number;
  readonly contrast?: number;
  /** Grain-gradient intensity / noise (0 to 1). */
  readonly intensity?: number;
  readonly noise?: number;
  /** Animation speed when not static. */
  readonly speed?: number;
};

/** DotGrid geometry from Paper Island Shells ShaderDotGrid extract. */
export type DotGridSurfaceParams = {
  readonly gapX?: number;
  readonly gapY?: number;
  readonly strokeWidth?: number;
  readonly sizeRange?: number;
  readonly opacityRange?: number;
  readonly shape?: DotGridShape;
  /** Stroke token suffix after --ij- when strokeWidth > 0. */
  readonly colorStroke?: string;
};

type ShaderSurfaceProps = {
  className?: string;
  style?: CSSProperties;
  material?: MaterialState;
  /** Suffix after --ij- (e.g. editor). Resolved via var(--ij-${suffix}). */
  colorBack?: string;
  colorFill?: string;
  gap?: number;
  size?: number;
  /** When true, never animate even if reduced-motion is off. */
  staticOnly?: boolean;
  /** Force a Paper fragment; defaults from the material map. */
  paperShader?: PaperShaderOverride;
  paper?: PaperSurfaceParams;
  /** DotGrid-only geometry; defaults match Paper Island Shells Dot Grid. */
  dotGrid?: DotGridSurfaceParams;
};

function resolveCssColor(css: string): string {
  const probe = document.createElement('div');
  probe.style.color = css;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed;
}

function ijVar(suffix: string): string {
  return `var(--ij-${suffix})`;
}

function sizingUniforms(kind: 'object' | 'pattern') {
  const sizing = kind === 'object' ? defaultObjectSizing : defaultPatternSizing;
  return {
    u_fit: ShaderFitOptions[sizing.fit],
    u_scale: sizing.scale,
    u_rotation: sizing.rotation,
    u_offsetX: sizing.offsetX,
    u_offsetY: sizing.offsetY,
    u_originX: sizing.originX,
    u_originY: sizing.originY,
    u_worldWidth: sizing.worldWidth,
    u_worldHeight: sizing.worldHeight,
  };
}

function fragmentFor(shader: PaperShaderOverride): string {
  switch (shader) {
    case 'paper-texture':
      return paperTextureFragmentShader;
    case 'dithering':
      return ditheringFragmentShader;
    case 'fluted-glass':
      return flutedGlassFragmentShader;
    case 'grain-gradient':
      return grainGradientFragmentShader;
    case 'dot-grid':
    default:
      return dotGridFragmentShader;
  }
}

function resolveShaderName(
  materialShader: ReturnType<typeof resolveMaterial>['shader'],
  override?: PaperShaderOverride,
): PaperShaderOverride {
  if (override) return override;
  switch (materialShader) {
    case 'paper-texture':
      return 'paper-texture';
    case 'dithering':
      return 'dithering';
    case 'fluted-glass':
      return 'fluted-glass';
    case 'dot-grid':
    case 'none':
    default:
      return 'dot-grid';
  }
}

function buildUniforms(
  shader: PaperShaderOverride,
  back: string,
  fill: string,
  gap: number,
  size: number,
  amplitude: number,
  paper: PaperSurfaceParams | undefined,
  dotGrid: DotGridSurfaceParams | undefined,
  stroke: string,
): ShaderMountUniforms {
  const backRgba = getShaderColorFromString(back);
  const fillRgba = getShaderColorFromString(fill);
  const strokeRgba = getShaderColorFromString(stroke);
  const noise = getShaderNoiseTexture();

  switch (shader) {
    case 'paper-texture':
      return {
        ...sizingUniforms('object'),
        u_image: undefined,
        u_noiseTexture: noise,
        u_colorFront: fillRgba,
        u_colorBack: backRgba,
        u_contrast: paper?.contrast ?? Math.min(1, 0.3 + amplitude),
        u_roughness: paper?.roughness ?? Math.min(1, 0.15 + amplitude * 0.5),
        u_fiber: paper?.fiber ?? Math.min(1, 0.2 + amplitude * 0.4),
        u_fiberSize: paper?.fiberSize ?? Math.max(0.14, 0.35 - amplitude * 0.1),
        u_crumples: paper?.crumples ?? amplitude * 0.15,
        u_crumpleSize: 0.35,
        u_folds: 0,
        u_foldCount: 1,
        u_fade: 0,
        u_drops: 0.05,
        u_seed: 7,
      };
    case 'dithering':
      return {
        ...sizingUniforms('pattern'),
        u_colorBack: backRgba,
        u_colorFront: fillRgba,
        u_shape: DitheringShapes.wave,
        u_type: DitheringTypes['4x4'],
        u_pxSize: Math.max(0.5, size * 2),
      };
    case 'fluted-glass':
      return {
        ...sizingUniforms('object'),
        // emptyPixel is a 1x1 data URL; ShaderMount accepts image strings at runtime.
        u_image: emptyPixel as unknown as HTMLImageElement,
        u_colorBack: backRgba,
        u_colorShadow: fillRgba,
        u_colorHighlight: fillRgba,
        u_shadows: 0.35,
        u_highlights: 0.2,
        u_size: 0.45,
        u_shape: GlassGridShapes.lines,
        u_angle: 12,
        u_distortionShape: GlassDistortionShapes.prism,
        u_distortion: 0.35,
        u_shift: 0,
        u_stretch: 0.1,
        u_blur: 0.15,
        u_edges: 0.2,
        u_marginLeft: 0,
        u_marginRight: 0,
        u_marginTop: 0,
        u_marginBottom: 0,
        u_grainMixer: 0.2,
        u_grainOverlay: Math.min(0.4, amplitude),
        u_noiseTexture: noise,
      };
    case 'grain-gradient':
      return {
        ...sizingUniforms('pattern'),
        u_colorBack: backRgba,
        u_colors: [fillRgba, backRgba],
        u_colorsCount: 2,
        u_softness: 0.7,
        u_intensity: paper?.intensity ?? 0.25,
        u_noise: paper?.noise ?? 0.35,
        u_shape: GrainGradientShapes.wave,
        u_noiseTexture: noise,
      };
    case 'dot-grid':
    default: {
      const gapX = dotGrid?.gapX ?? gap;
      const gapY = dotGrid?.gapY ?? gap;
      const shape = dotGrid?.shape ?? 'circle';
      return {
        ...sizingUniforms('pattern'),
        u_colorBack: backRgba,
        u_colorFill: fillRgba,
        u_colorStroke: strokeRgba,
        u_dotSize: size,
        u_gapX: gapX,
        u_gapY: gapY,
        u_strokeWidth: dotGrid?.strokeWidth ?? 0,
        u_sizeRange: dotGrid?.sizeRange ?? 0,
        u_opacityRange: dotGrid?.opacityRange ?? amplitude,
        u_shape: DotGridShapes[shape],
      };
    }
  }
}

/**
 * Repo-owned Paper mount: owns the host, reads getContext from the mount canvas
 * in this file (motion gate), enforces context budget and reduced-motion.
 */
export function ShaderSurface({
  className,
  style,
  material = 'Deterministic',
  colorBack = 'editor',
  colorFill = 'seam-raised',
  gap = 24,
  size = 1.5,
  staticOnly = true,
  paperShader,
  paper,
  dotGrid,
}: ShaderSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<ShaderMount | null>(null);
  const tokenRef = useRef<object | null>(null);
  const { reduced } = useMotionDurations();
  const [fallback, setFallback] = useState(false);
  const descriptor = resolveMaterial(material);
  const shader = resolveShaderName(descriptor.shader, paperShader);
  const paperKey = JSON.stringify(paper ?? null);
  const dotGridKey = JSON.stringify(dotGrid ?? null);
  const colorStroke = dotGrid?.colorStroke ?? colorFill;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const markFallback = () => {
      if (!cancelled) setFallback(true);
    };

    if (LIVE_MOUNTS.size >= SHADER_CONTEXT_BUDGET) {
      queueMicrotask(markFallback);
      return () => {
        cancelled = true;
      };
    }

    const paperParams = (JSON.parse(paperKey) as PaperSurfaceParams | null) ?? undefined;
    const dotGridParams = (JSON.parse(dotGridKey) as DotGridSurfaceParams | null) ?? undefined;
    const back = resolveCssColor(ijVar(colorBack));
    const fill = resolveCssColor(ijVar(colorFill));
    const stroke = resolveCssColor(ijVar(colorStroke));
    const requestedSpeed = paperParams?.speed ?? 0.35;
    const speed = reduced || staticOnly || (descriptor.amplitude === 0 && shader === 'dot-grid')
      ? 0
      : requestedSpeed;

    const uniforms = buildUniforms(
      shader,
      back,
      fill,
      gap,
      size,
      descriptor.amplitude,
      paperParams,
      dotGridParams,
      stroke,
    );

    let mount: ShaderMount;
    try {
      mount = new ShaderMount(host, fragmentFor(shader), uniforms, undefined, speed);
    } catch {
      queueMicrotask(markFallback);
      return () => {
        cancelled = true;
      };
    }

    // Motion gate provenance: this file owns a WebGL context via the mount canvas.
    const gl = mount.canvasElement.getContext('webgl2') ?? mount.canvasElement.getContext('webgl');
    if (!gl) {
      mount.dispose();
      queueMicrotask(markFallback);
      return () => {
        cancelled = true;
      };
    }

    const token = {};
    tokenRef.current = token;
    LIVE_MOUNTS.add(token);
    mountRef.current = mount;
    queueMicrotask(() => {
      if (!cancelled) setFallback(false);
    });

    const observer = new MutationObserver(() => {
      const nextBack = resolveCssColor(ijVar(colorBack));
      const nextFill = resolveCssColor(ijVar(colorFill));
      const nextStroke = resolveCssColor(ijVar(colorStroke));
      mount.setUniforms(buildUniforms(
        shader,
        nextBack,
        nextFill,
        gap,
        size,
        descriptor.amplitude,
        paperParams,
        dotGridParams,
        nextStroke,
      ));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        mount.setSpeed(visible && !reduced && !staticOnly ? speed : 0);
      },
      { threshold: 0.01 },
    );
    io.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      io.disconnect();
      mount.dispose();
      mountRef.current = null;
      if (tokenRef.current) LIVE_MOUNTS.delete(tokenRef.current);
      tokenRef.current = null;
    };
  }, [
    colorBack,
    colorFill,
    colorStroke,
    descriptor.amplitude,
    dotGridKey,
    gap,
    paperKey,
    reduced,
    shader,
    size,
    staticOnly,
  ]);

  if (fallback) {
    const gapX = dotGrid?.gapX ?? gap;
    const gapY = dotGrid?.gapY ?? gap;
    return (
      <div
        className={className}
        aria-hidden
        style={{
          ...style,
          backgroundColor: ijVar(colorBack),
          backgroundImage: shader === 'paper-texture' || shader === 'grain-gradient'
            ? undefined
            : `radial-gradient(circle, ${ijVar(colorFill)} 1px, transparent 1px)`,
          backgroundSize: `${gapX}px ${gapY}px`,
          opacity: shader === 'paper-texture' ? 0.92 : 1,
        }}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      data-paper-shader={shader}
      data-dot-grid-shape={shader === 'dot-grid' ? (dotGrid?.shape ?? 'circle') : undefined}
      style={{ ...style, width: '100%', height: '100%' }}
      aria-hidden
    />
  );
}
