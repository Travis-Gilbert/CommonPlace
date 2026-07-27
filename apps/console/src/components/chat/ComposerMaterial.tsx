'use client';

// SOURCING: @paper-design/shaders-react GrainGradient (chosen from SH9
// candidates Dithering / GrainGradient / FlutedGlass).
// Choice: GrainGradient with wave shape. It contributes light and grain over
// the opaque register surface without introducing a new hue: colorBack and
// colors resolve to the raised surface token, intensity and noise stay low.
// Dithering was rejected as a two-ink pattern that reads as drawing rather
// than catch-light; FlutedGlass was rejected as a refraction effect that
// wants backdrop content we deliberately do not blur under.
// Parameters: shape=wave, softness=0.7, intensity=0.18, noise=0.35,
// opacity via wrapper (0.22). speed binds to state only (SH9):
//   idle 0, composing 0.25, streaming 0.55; prefers-reduced-motion forces 0.
// No backdrop-filter. Layer order: opaque surface, then this mount, then content.

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

export function ComposerMaterial({ state, className }: ComposerMaterialProps) {
  const reduced = useReducedMotion();
  const speed = reduced ? 0 : SPEED[state];

  return (
    <div
      data-composer-material
      data-material-state={state}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity: 0.22 }}
    >
      <GrainGradient
        width="100%"
        height="100%"
        speed={speed}
        shape="wave"
        softness={0.7}
        intensity={0.18}
        noise={0.35}
        // Same token family as the opaque surface so the shader never paints a
        // foreign hue; measured fill with the shader disabled is bg-ij-raised.
        colorBack="var(--ij-raised)"
        colors={['var(--ij-raised)', 'var(--ij-editor)', 'var(--ij-hover-surface)']}
      />
    </div>
  );
}
