'use client';

// SOURCING: textmode.js (SPEC-UI-SOURCING-ADDENDUM D1: the Presence mark).
// The agent's visible identity: one living form rendered in type, replacing
// every spinner and typing affordance on agent paths. Round-one state subset
// (G7): idle, composing (thinking), acting (condensation with the accent
// commit flash), interrupted (settles within one frame). Motion math is
// implemented by hand (the pts choreography reference ships no code).
// Reduced motion and the no-WebGL2 path render the static constellation
// WITHOUT the library. The canvas never intercepts pointer events.

import { useEffect, useRef, useState } from 'react';
import { MARK } from '@/motion/motion-tokens';

export type MarkState = 'idle' | 'composing' | 'acting' | 'interrupted';

interface PresenceMarkProps {
  readonly state: MarkState;
  /** Logical size of the square mark stage; about 64 per the addendum. */
  readonly size?: number;
}

// The static constellations: one per state, rendered as plain text when the
// library is absent (no WebGL2) or motion is reduced. Density carries state:
// calm is sparse, intent condenses.
const STATIC_CONSTELLATIONS: Record<MarkState, string[]> = {
  idle: ['· ˙  ·', ' ˙ ·  ', '·  ˙ ·'],
  composing: ['· : ˙ ·', ' ˙ · : ', '· : · ˙'],
  acting: [' ::: ', ':::::', ' ::: '],
  interrupted: ['· · ·', ' · · ', '· · ·'],
};

const GLYPHS = ['·', ':', '˙', '.', "'"];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function StaticConstellation({ state, size }: { state: MarkState; size: number }) {
  return (
    <pre
      aria-hidden="true"
      className="pointer-events-none m-0 select-none text-center font-ij-mono leading-none"
      style={{ width: size, height: size, color: state === 'acting' ? 'var(--ij-accent)' : 'var(--ij-gold)' }}
      data-mark-state={state}
      data-mark-mode="static"
    >
      {STATIC_CONSTELLATIONS[state].join('\n')}
    </pre>
  );
}

export function PresenceMark({ state, size = 64 }: PresenceMarkProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<MarkState>(state);
  const [mode, setMode] = useState<'pending' | 'live' | 'static'>('pending');
  stateRef.current = state;

  useEffect(() => {
    if (prefersReducedMotion() || !hasWebGL2()) {
      setMode('static');
      return;
    }
    let disposed = false;
    let modifier: { destroy(): void; noLoop(): void; loop(): void } | null = null;

    // textmode.js is WebGL2-only and browser-only: dynamic import keeps it
    // out of the SSR bundle and off the no-WebGL2 path entirely. The runtime
    // exposes `textmode.create` (the d.ts index omits the namespace object,
    // so it is typed here from the documented API).
    void import('textmode.js').then((module) => {
      const Textmode = (module as unknown as {
        textmode: { create(opts?: { canvas?: HTMLCanvasElement; fontSize?: number; frameRate?: number }): unknown };
      }).textmode;
      if (disposed || !hostRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.style.pointerEvents = 'none';
      canvas.width = size;
      canvas.height = size;
      hostRef.current.appendChild(canvas);
      try {
        const t = Textmode.create({ canvas, fontSize: 10, frameRate: 30 }) as Drawable & {
          destroy(): void;
          noLoop(): void;
          loop(): void;
          background(gray: number, alpha?: number): void;
          draw(callback: () => void): void;
          grid: { cols: number; rows: number };
        };
        modifier = t;
        // Interruption settles within one frame: the draw callback reads the
        // latest state ref every frame, so a state flip renders next frame.
        let tick = 0;
        let flash = 0;
        t.draw(() => {
          const current = stateRef.current;
          tick += 1;
          t.background(0, 0);
          const cols = t.grid.cols;
          const rows = t.grid.rows;
          const cx = Math.floor(cols / 2);
          const cy = Math.floor(rows / 2);
          if (current === 'acting') flash = MARK.commitFlashMs;
          else if (flash > 0) flash -= 1000 / 30;

          if (current === 'interrupted') {
            drawStatic(t, cx, cy, 5);
            return;
          }
          if (current === 'idle') {
            const phase = Math.floor((tick * (1000 / 30)) / MARK.idleCycleMs);
            drawOrbit(t, cx, cy, 4, 3, phase + tick * 0.008, 'var(--ij-gold)');
            return;
          }
          if (current === 'composing') {
            const phase = tick * ((1000 / 30) / MARK.composeCycleMs);
            drawOrbit(t, cx, cy, 7, 2.6, phase, 'var(--ij-gold)');
            return;
          }
          // acting: the constellation condenses into a solid glyph with the
          // commit flash on the accent slot, then releases.
          drawCondense(t, cx, cy, flash > 0);
        });
      } catch {
        setMode('static');
        canvas.remove();
        return;
      }
      setMode('live');
    }).catch(() => setMode('static'));

    return () => {
      disposed = true;
      modifier?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  if (mode === 'static' ) {
    return (
      <div className="pointer-events-none inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <StaticConstellation state={state} size={size} />
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-mark-state={state}
      data-mark-mode={mode}
      className="pointer-events-none inline-flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size }}
    />
  );
}

// Hand-rolled choreography math (flow, orbit, convergence) per the addendum;
// resolved register colors are read from the computed style at draw time.
type Drawable = {
  char(glyph: string): void;
  charColor(r: number, g: number, b: number, a?: number): void;
  rect(x: number, y: number, w?: number, h?: number): void;
};

// The register gold as RGB components, for the frames before the computed
// style resolves. Numeric mirror of --ij-gold (Yellow6); the register file
// stays the single hex source.
const GOLD_RGB: [number, number, number] = [214, 174, 88];

function inkFor(token: string): [number, number, number] {
  if (typeof window === 'undefined') return GOLD_RGB;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(tokenName(token)).trim();
  if (!raw.startsWith('#') || raw.length < 7) return GOLD_RGB;
  return [
    parseInt(raw.slice(1, 3), 16),
    parseInt(raw.slice(3, 5), 16),
    parseInt(raw.slice(5, 7), 16),
  ];
}

function tokenName(varExpr: string): string {
  const match = varExpr.match(/var\((--[a-z0-9-]+)\)/i);
  return match ? match[1] : varExpr;
}

const GOLD = 'var(--ij-gold)';
const ACCENT = 'var(--ij-accent)';

function drawOrbit(t: Drawable, cx: number, cy: number, count: number, radius: number, phase: number, ink: string) {
  const [r, g, b] = inkFor(ink);
  for (let i = 0; i < count; i += 1) {
    const angle = phase + (i / count) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius * 0.7);
    t.charColor(r, g, b, 220);
    t.char(GLYPHS[i % GLYPHS.length]);
    t.rect(x, y, 1, 1);
  }
}

function drawStatic(t: Drawable, cx: number, cy: number, count: number) {
  const [r, g, b] = inkFor(GOLD);
  for (let i = 0; i < count; i += 1) {
    const x = cx + ((i * 2654435761) % 5) - 2;
    const y = cy + ((i * 40503) % 3) - 1;
    t.charColor(r, g, b, 200);
    t.char('·');
    t.rect(x, y, 1, 1);
  }
}

function drawCondense(t: Drawable, cx: number, cy: number, flashing: boolean) {
  const [r, g, b] = inkFor(flashing ? ACCENT : GOLD);
  t.charColor(r, g, b, 255);
  t.char(':');
  t.rect(cx, cy, 1, 1);
  t.charColor(r, g, b, 180);
  t.char('·');
  t.rect(cx - 1, cy, 1, 1);
  t.rect(cx + 1, cy, 1, 1);
  t.rect(cx, cy - 1, 1, 1);
  t.rect(cx, cy + 1, 1, 1);
}
