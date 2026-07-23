// SOURCING: @paper-design/shaders via ShaderSurface (SPEC-MATERIAL-REGISTER-1.0 D6).
'use client';

import { ShaderSurface } from '@/components/material/ShaderSurface';

/** Quiet DotGrid ground behind the data canvas. Declared paint surface. */
export function CanvasPaperGround({ className }: { className?: string }) {
  return (
    <ShaderSurface
      className={className}
      material="Deterministic"
      colorBack="editor"
      colorFill="seam-raised"
      gap={24}
      size={1.5}
      staticOnly
    />
  );
}
