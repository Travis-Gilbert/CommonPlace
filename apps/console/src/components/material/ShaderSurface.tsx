// SOURCING: @paper-design/shaders ShaderMount (vanilla). Owns canvas + getContext in-file
// for SPEC-MATERIAL-REGISTER-1.0 D6 / motion gate.
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ShaderMount,
  dotGridFragmentShader,
  DotGridShapes,
  getShaderColorFromString,
  defaultPatternSizing,
  ShaderFitOptions,
} from '@paper-design/shaders';
import { useMotionDurations } from '@/motion/motion-tokens';
import { resolveMaterial, type MaterialState } from '@/lib/material/materials';

const LIVE_MOUNTS = new Set<object>();
/** Hard cap: browsers allow few live WebGL contexts (named choice 6). */
export const SHADER_CONTEXT_BUDGET = 4;

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
}: ShaderSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<ShaderMount | null>(null);
  const tokenRef = useRef<object | null>(null);
  const { reduced } = useMotionDurations();
  const [fallback, setFallback] = useState(false);
  const descriptor = resolveMaterial(material);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (LIVE_MOUNTS.size >= SHADER_CONTEXT_BUDGET) {
      setFallback(true);
      return;
    }

    const back = resolveCssColor(ijVar(colorBack));
    const fill = resolveCssColor(ijVar(colorFill));
    const speed = reduced || staticOnly || descriptor.amplitude === 0 ? 0 : 0.4;

    const uniforms = {
      u_colorBack: getShaderColorFromString(back),
      u_colorFill: getShaderColorFromString(fill),
      u_colorStroke: getShaderColorFromString(fill),
      u_dotSize: size,
      u_gapX: gap,
      u_gapY: gap,
      u_strokeWidth: 0,
      u_sizeRange: 0,
      u_opacityRange: descriptor.amplitude,
      u_shape: DotGridShapes.circle,
      u_fit: ShaderFitOptions[defaultPatternSizing.fit],
      u_scale: defaultPatternSizing.scale,
      u_rotation: defaultPatternSizing.rotation,
      u_offsetX: defaultPatternSizing.offsetX,
      u_offsetY: defaultPatternSizing.offsetY,
      u_originX: defaultPatternSizing.originX,
      u_originY: defaultPatternSizing.originY,
      u_worldWidth: defaultPatternSizing.worldWidth,
      u_worldHeight: defaultPatternSizing.worldHeight,
    };

    let mount: ShaderMount;
    try {
      mount = new ShaderMount(host, dotGridFragmentShader, uniforms, undefined, speed);
    } catch {
      setFallback(true);
      return;
    }

    // Motion gate provenance: this file owns a WebGL context via the mount canvas.
    const gl = mount.canvasElement.getContext('webgl') ?? mount.canvasElement.getContext('webgl2');
    if (!gl) {
      mount.dispose();
      setFallback(true);
      return;
    }

    const token = {};
    tokenRef.current = token;
    LIVE_MOUNTS.add(token);
    mountRef.current = mount;
    setFallback(false);

    const observer = new MutationObserver(() => {
      const nextBack = getShaderColorFromString(resolveCssColor(ijVar(colorBack)));
      const nextFill = getShaderColorFromString(resolveCssColor(ijVar(colorFill)));
      mount.setUniforms({
        u_colorBack: nextBack,
        u_colorFill: nextFill,
        u_colorStroke: nextFill,
      });
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
      observer.disconnect();
      io.disconnect();
      mount.dispose();
      mountRef.current = null;
      if (tokenRef.current) LIVE_MOUNTS.delete(tokenRef.current);
      tokenRef.current = null;
    };
  }, [colorBack, colorFill, descriptor.amplitude, gap, reduced, size, staticOnly]);

  if (fallback) {
    return (
      <div
        className={className}
        aria-hidden
        style={{
          ...style,
          backgroundColor: ijVar(colorBack),
          backgroundImage: `radial-gradient(circle, ${ijVar(colorFill)} 1px, transparent 1px)`,
          backgroundSize: `${gap}px ${gap}px`,
        }}
      />
    );
  }

  return <div ref={hostRef} className={className} style={{ ...style, width: '100%', height: '100%' }} aria-hidden />;
}
