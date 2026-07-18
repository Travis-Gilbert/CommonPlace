'use client';

// SOURCING: hand-roll (GroundCanvas). The ledger names this the one
// register-derived ambient canvas behind the frame (G4, named choice 5):
// grounds are canvas, chrome is still. A quiet texture of register-colored
// points drifts slowly; the repaint loop is throttled to GROUND.tickMs and
// pauses entirely when the tab is hidden or reduced motion is set (static
// texture, painted once). The canvas sits behind the frame and never
// intercepts pointer events.

import { useEffect, useRef } from 'react';
import { GROUND } from '@/motion/motion-tokens';

// Deterministic point field (djb2 + LCG, repo convention; no Math.random).
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

interface GroundPoint {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
}

export function GroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let points: GroundPoint[] = [];
    let phase = 0;
    let rafId = 0;
    let lastTick = 0;
    let running = true;

    const seedPoints = () => {
      const rand = lcg(0x1e1f22);
      const count = Math.max(24, Math.floor((width * height) / 28000));
      points = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        radius: 0.6 + rand() * 1.1,
        alpha: 0.04 + rand() * 0.07,
        drift: 0.4 + rand() * 0.6,
      }));
    };

    const ink = (): string | null => {
      // Strictly register-derived: if the token is somehow absent, paint
      // nothing rather than fall back to a literal.
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--ij-gray-5').trim();
      return raw.length > 0 ? raw : null;
    };

    const paint = () => {
      context.clearRect(0, 0, width, height);
      const color = ink();
      if (!color) return;
      for (const point of points) {
        const y = (point.y + phase * point.drift) % height;
        context.globalAlpha = point.alpha;
        context.fillStyle = color;
        context.beginPath();
        context.arc(point.x, y, point.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const resize = () => {
      // Canvas dimension guards (repo convention): min 1px, cap 8192px.
      const w = Math.min(canvas.clientWidth, 8192);
      const h = Math.min(canvas.clientHeight, 8192);
      if (w < 1 || h < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = w;
      height = h;
      seedPoints();
      paint();
    };

    const tick = (time: number) => {
      if (!running) return;
      rafId = requestAnimationFrame(tick);
      // Throttled to the register tick so idle cost stays negligible; the
      // loop draws nothing when the document is hidden.
      if (document.hidden) return;
      if (time - lastTick < GROUND.tickMs) return;
      lastTick = time;
      phase += GROUND.drift;
      paint();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (!reduced) rafId = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-ground-canvas
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
