// SOURCING: Paper Island Shells ShaderDotGrid (BA-0 / B9-0) via
// @paper-design/shaders DotGrid fragment. Geometry extracted from Paper JSX:
// size 0.7, gapX/Y 32, shape triangle, strokeWidth 0. Colors stay register
// tokens for the dark console (Paper's light fill + CSS invert is design-tool
// presentation, not product chrome).

'use client';

import { ShaderSurface } from '@/components/material/ShaderSurface';

/** Quiet Paper DotGrid ground behind the data canvas. Declared paint surface. */
export function CanvasPaperGround({ className }: { className?: string }) {
  return (
    <ShaderSurface
      className={className}
      material="Deterministic"
      paperShader="dot-grid"
      colorBack="editor"
      colorFill="seam-raised"
      gap={32}
      size={0.7}
      staticOnly
      dotGrid={{
        gapX: 32,
        gapY: 32,
        shape: 'triangle',
        strokeWidth: 0,
        sizeRange: 0,
        opacityRange: 0,
        colorStroke: 'accent',
      }}
    />
  );
}
