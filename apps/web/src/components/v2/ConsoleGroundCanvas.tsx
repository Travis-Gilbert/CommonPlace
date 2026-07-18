// SOURCING: hand-roll. Adapts the repo's own DotField/PaneDotGrid contained
// canvas pattern (djb2 + mulberry32 PRNG, dimension guards, ResizeObserver);
// no upstream component models a register-token ambient canvas ground.

'use client';

import { useEffect, useRef } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { readOklchVar } from '@/lib/v2/oklch-read';

/* ConsoleGroundCanvas: the quiet living texture of the console ground (HP3).
 *
 * A sparse dot field in ink-3 at low opacity, drifting very slowly in opacity
 * only (no spatial movement), painted on a transparent canvas over the
 * layout's bg-cr-ground so the ground color itself always comes from the
 * register. Seeded from the tenant slug so the texture is stable and
 * personal. Decoration only: aria-hidden, pointer-events none, and it paints
 * at z-index -1 inside the console layout's isolated stacking context, so it
 * sits above the ground fill but below the rail and the opaque content sheet.
 *
 * Budget contract (HP3 acceptance: idle-tab CPU under one percent):
 *   - one requestAnimationFrame loop, throttled to ~30fps;
 *   - parked when the tab is hidden (visibilitychange) or the host is
 *     off screen (IntersectionObserver);
 *   - prefers-reduced-motion renders exactly one static frame, no loop.
 */

/** Same PRNG pair as DotField/PaneDotGrid: deterministic across renders. */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TENANT = process.env.NEXT_PUBLIC_COMMONPLACE_TENANT ?? 'Travis-Gilbert';
const SPACING = 22;
const DOT_RADIUS = 0.6;
const BASE_OPACITY = 0.05;
const OPACITY_JITTER = 0.03;
/** Fraction of grid cells that carry a dot (sparse scatter, as in DotField). */
const SCATTER_KEEP = 0.45;
/** Opacity drift: subtle amplitude on a slow shared clock with per-dot phase. */
const DRIFT_AMPLITUDE = 0.02;
const DRIFT_PERIOD_MS = 9000;
/** ~30fps is plenty for a slow opacity drift; halves the paint cost. */
const FRAME_INTERVAL_MS = 33;

type Dot = { x: number; y: number; base: number; phase: number };

export function ConsoleGroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    const maybeCanvas = canvasRef.current;
    if (!maybeCanvas) return;
    const maybeParent = maybeCanvas.parentElement;
    if (!maybeParent) return;
    const maybeCtx = maybeCanvas.getContext('2d', { alpha: true });
    if (!maybeCtx) return;
    // Rebind after the guards: narrowing applies at const initialization, so
    // the nested draw/loop functions see non-null types.
    const canvas = maybeCanvas;
    const parent = maybeParent;
    const ctx = maybeCtx;

    const [r, g, b] = readOklchVar('--cr-ink-3');
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let lastFrame = 0;
    let onScreen = true;
    let disposed = false;

    function drawFrame(now: number) {
      ctx.clearRect(0, 0, width, height);
      const t = ((now % DRIFT_PERIOD_MS) / DRIFT_PERIOD_MS) * Math.PI * 2;
      for (const dot of dots) {
        const opacity = reducedMotion
          ? dot.base
          : Math.max(0, dot.base + Math.sin(t + dot.phase) * DRIFT_AMPLITUDE);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function rebuild() {
      if (window.innerWidth < 768) {
        canvas.style.display = 'none';
        dots = [];
        return;
      }
      canvas.style.display = '';
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w < 1 || h < 1) return;
      width = Math.min(w, 8192);
      height = Math.min(h, 8192);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rng = mulberry32(djb2(TENANT));
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;
      const next: Dot[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Consume the same PRNG draws per cell whether or not the dot is
          // kept, so the field is a stable function of the seed and grid.
          const keep = rng() <= SCATTER_KEEP;
          const base = BASE_OPACITY + rng() * OPACITY_JITTER;
          const phase = rng() * Math.PI * 2;
          if (!keep) continue;
          next.push({ x: col * SPACING, y: row * SPACING, base, phase });
        }
      }
      dots = next;
      drawFrame(performance.now());
    }

    function tick(now: number) {
      raf = 0;
      if (disposed) return;
      if (now - lastFrame >= FRAME_INTERVAL_MS) {
        lastFrame = now;
        drawFrame(now);
      }
      schedule();
    }

    function schedule() {
      if (disposed || reducedMotion || !onScreen) return;
      if (document.visibilityState === 'hidden') return;
      if (raf === 0) raf = requestAnimationFrame(tick);
    }

    function park() {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') park();
      else schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (onScreen) schedule();
      else park();
    });
    io.observe(parent);

    const ro = new ResizeObserver(rebuild);
    ro.observe(parent);

    rebuild();
    schedule();

    return () => {
      disposed = true;
      park();
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      ro.disconnect();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={1}
      height={1}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1 }}
    />
  );
}
