'use client';

// SOURCING: @paper-design/shaders-react GrainGradient (chosen from SH9
// candidates Dithering / GrainGradient / FlutedGlass).
// Choice: GrainGradient with wave shape. It contributes light and grain over
// the opaque register surface without introducing a new hue.
// Parameters: shape=wave, softness=0.7, intensity=0.18, noise=0.35,
// opacity via wrapper (0.22). speed binds to state only (SH9):
//   idle 0, composing 0.25, streaming 0.55; prefers-reduced-motion forces 0.
// No backdrop-filter. Layer order: opaque surface, then this mount, then content.
//
// Color contract: Paper's getShaderColorFromString only accepts hash / rgb /
// hsl literals. Passing var(--ij-*) falls through to mid-grey. Resolve tokens
// through the browser to concrete computed color strings (oklch register values
// convert here), then memoize so GrainGradient's colorPropsAreEqual still hits.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GrainGradient } from '@paper-design/shaders-react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export type ComposerMaterialState = 'idle' | 'composing' | 'streaming';

export interface ComposerMaterialProps {
  readonly state: ComposerMaterialState;
  readonly className?: string;
}

const SPEED: Record<ComposerMaterialState, number> = {
  idle: 0,
  composing: 0.25,
  streaming: 0.55,
};

const TOKEN_SUFFIXES = ['raised', 'editor', 'hover-surface'] as const;

type ResolvedShaderColors = {
  readonly colorBack: string;
  readonly colors: readonly [string, string, string];
};

function resolveIjToken(suffix: (typeof TOKEN_SUFFIXES)[number]): string {
  const probe = document.createElement('div');
  probe.style.color = `var(--ij-${suffix})`;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  // getComputedStyle returns rgb/rgba for oklch register values.
  return computed;
}

function readShaderColors(): ResolvedShaderColors {
  const raised = resolveIjToken('raised');
  const editor = resolveIjToken('editor');
  const hover = resolveIjToken('hover-surface');
  return {
    colorBack: raised,
    colors: [raised, editor, hover],
  };
}

export function ComposerMaterial({ state, className }: ComposerMaterialProps) {
  const reduced = useReducedMotion();
  const speed = reduced ? 0 : SPEED[state];
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [resolved, setResolved] = useState<ResolvedShaderColors | null>(null);

  useLayoutEffect(() => {
    // Resolve once the host is in the document so CSS variables are live.
    // Re-run when the document theme attribute changes.
    const sync = () => setResolved(readShaderColors());
    sync();
    const root = document.documentElement;
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => observer.disconnect();
  }, []);

  const colorBack = resolved?.colorBack;
  const colors = useMemo(
    () => (resolved ? [...resolved.colors] : undefined),
    [resolved],
  );

  return (
    <div
      ref={hostRef}
      data-composer-material
      data-material-state={state}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity: 0.22 }}
    >
      {colorBack && colors ? (
        <GrainGradient
          width="100%"
          height="100%"
          speed={speed}
          shape="wave"
          softness={0.7}
          intensity={0.18}
          noise={0.35}
          colorBack={colorBack}
          colors={colors}
        />
      ) : null}
    </div>
  );
}
