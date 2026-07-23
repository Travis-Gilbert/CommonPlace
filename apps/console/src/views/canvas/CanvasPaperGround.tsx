// SOURCING: @paper-design/shaders-react DotGrid (https://github.com/paper-design/shaders).
// Paper MCP was unavailable; the installed npm package is the wiring path.
'use client';

import { useEffect, useState } from 'react';
import { DotGrid } from '@paper-design/shaders-react';

type PaperColors = {
  back: string;
  fill: string;
};

function resolveCssColor(css: string): string {
  const probe = document.createElement('div');
  probe.style.color = css;
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return computed;
}

function readRegisterColors(): PaperColors {
  return {
    back: resolveCssColor('var(--ij-editor)'),
    fill: resolveCssColor('var(--ij-seam-raised)'),
  };
}

/**
 * Quiet Paper DotGrid behind the data canvas React Flow pane.
 * Colors resolve from register tokens at runtime (no hex in source).
 * DotGrid is a static Paper shader (ShaderMount defaults speed to 0).
 */
export function CanvasPaperGround({ className }: { className?: string }) {
  const [colors, setColors] = useState<PaperColors | null>(null);

  useEffect(() => {
    const apply = () => setColors(readRegisterColors());
    apply();

    const root = document.documentElement;
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', apply);
    };
  }, []);

  if (!colors) {
    return <div className={className} aria-hidden />;
  }

  return (
    <div className={className} aria-hidden>
      <DotGrid
        colorBack={colors.back}
        colorFill={colors.fill}
        colorStroke={colors.fill}
        size={1.5}
        gapX={24}
        gapY={24}
        strokeWidth={0}
        sizeRange={0}
        opacityRange={0}
        shape="circle"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
