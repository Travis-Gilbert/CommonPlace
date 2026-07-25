'use client';

// SOURCING: @paper-design/shaders-react (PaperTexture, PulsingBorder).
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS4: exactly one ShaderMount per window.
// Color comes from CSS paper-canvas; the shader is transparent static grain.
// Motion is reserved for state (PulsingBorder on the docked rail while a run
// is active). prefers-reduced-motion forces speed 0 and a static border.

import { useEffect, useState } from 'react';
import { PaperTexture, paperTexturePresets } from '@paper-design/shaders-react';

const TRANSPARENT = '#00000000';
const detailsPreset = paperTexturePresets.find((preset) => preset.name === 'Details')
  ?? paperTexturePresets[0];

export function PaperCanvas({
  textureEnabled = true,
}: {
  readonly textureEnabled?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReduced(media.matches);
    onMotion();
    media.addEventListener('change', onMotion);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      media.removeEventListener('change', onMotion);
    };
  }, []);

  const paused = hidden || reduced || !textureEnabled;
  const params = detailsPreset.params;

  return (
    <div
      data-paper-canvas
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ background: 'var(--paper-canvas, var(--ij-frame))' }}
    >
      {textureEnabled ? (
        <PaperTexture
          {...params}
          colorFront={TRANSPARENT}
          colorBack={TRANSPARENT}
          speed={paused ? 0 : 0}
          frame={0}
          roughness={Math.min(params.roughness ?? 1, 0.55)}
          fiber={Math.min(params.fiber ?? 0.27, 0.2)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.42,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}
