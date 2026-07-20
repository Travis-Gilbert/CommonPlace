'use client';

// SOURCING: hand-roll (GrainCanvas), the sibling of GroundCanvas on the ledger
// row it shares. No upstream component models "a register-derived paper grain
// behind one board area"; the concept is the reading-surface grain from the
// design conversation, and GroundCanvas is the pattern it follows.

/**
 * The reading-surface grain (32-HANDOFF-PROACTIVITY-MATERIAL-AND-DENSITY named
 * choice 7). A quiet paper tooth behind the board area, so the content plane
 * reads as a surface you are reading ON rather than a void things float in.
 *
 * It is STATIC by construction, and that is the whole budget argument. The
 * handoff asks for negligible idle cost; the cheapest way to promise that is to
 * have no loop to account for. Paper does not drift, so there is nothing to
 * animate: the grain paints once per resize and then costs exactly zero. This
 * is also why it is absent from DECLARED_PAINT_SURFACES, which inventories
 * canvases that drive a frame loop (the motion gate has a reverse check and
 * would fail a declared surface that never animates). Under reduced motion it
 * is identical, because it is already still.
 *
 * The grain is a fixed deterministic field (djb2 + LCG, repo convention, no
 * Math.random), so a visual baseline can hold it.
 */

import { useEffect, useRef } from 'react';

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function GrainCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const paint = () => {
      // Canvas dimension guards (repo convention): min 1px, cap 8192px.
      const w = Math.min(canvas.clientWidth, 8192);
      const h = Math.min(canvas.clientHeight, 8192);
      if (w < 1 || h < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);

      // Strictly register-derived: if the token is absent, paint nothing rather
      // than fall back to a literal.
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ij-gray-5').trim();
      if (ink.length === 0) return;

      // Tooth, not texture: single-pixel marks at a low count and a very low
      // alpha. Dense enough to kill the flatness, sparse enough that you only
      // notice it when it is removed.
      const rand = lcg(0x70617065);
      const count = Math.min(4000, Math.floor((w * h) / 900));
      context.fillStyle = ink;
      for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h;
        context.globalAlpha = 0.02 + rand() * 0.035;
        context.fillRect(x, y, 1, 1);
      }
      context.globalAlpha = 1;
    };

    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();

    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-grain-canvas
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
