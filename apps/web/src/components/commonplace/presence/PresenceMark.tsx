'use client';

/**
 * The Presence mark (SPEC-UI-SOURCING-ADDENDUM, Presence D1/D2): the agent's
 * one visual identity, rendered in type with textmode.js on a dedicated small
 * canvas. One component, three mounts (co-browse telegraph, chat composing
 * indicator, run-activity glyph), sized per context.
 *
 * Loop discipline: the scene draws on its loop only while an animated state is
 * active. Idle runs noLoop plus a slow shimmer tick (one redraw every 1.6s).
 * Interruption settles to the static constellation within one frame (noLoop
 * plus a single redraw in the same tick). Reduced motion renders the static
 * constellation for every state. The canvas never intercepts pointer events.
 *
 * textmode.js is WebGL2-only; when the context is unavailable the component
 * renders nothing (no fake fallback spinner).
 */

import { useEffect, useRef } from 'react';
import type { Textmodifier } from 'textmode.js';
import {
  COMMIT_GLYPH,
  constellationFor,
  isAnimated,
  PRESENCE_GLYPHS,
  PRESENCE_GOLD,
  PRESENCE_OXBLOOD,
  type PresenceState,
} from './presenceStates';

const FONT_SIZE = 6;
const ACT_CONDENSE_FRAMES = 14;
const ACT_FLASH_FRAMES = 5;

export interface PresenceMarkProps {
  state: PresenceState;
  /** Logical square size in px; about 64 for the standalone mark. */
  size?: number;
  /** Accessible label for the mount context. */
  label?: string;
}

export function PresenceMark({ state, size = 64, label = 'Agent presence' }: PresenceMarkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Textmodifier | null>(null);
  const stateRef = useRef<PresenceState>(state);
  const frameRef = useRef(0);
  const shimmerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const applyLoopDisciplineRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = state;
    frameRef.current = 0;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let disposed = false;

    const applyLoopDiscipline = () => {
      const t = scene.current;
      if (!t) return;
      if (shimmerTimer.current) {
        clearInterval(shimmerTimer.current);
        shimmerTimer.current = null;
      }
      const current = stateRef.current;
      if (reducedMotion || !isAnimated(current)) {
        // Static settle within one frame; idle keeps a slow shimmer tick.
        t.noLoop();
        t.redraw(1);
        if (!reducedMotion && current === 'idle') {
          shimmerTimer.current = setInterval(() => {
            frameRef.current += 1;
            t.redraw(1);
          }, 1600);
        }
        return;
      }
      t.loop();
    };
    // Re-applied whenever the state prop changes (see the effect below).
    applyLoopDisciplineRef.current = applyLoopDiscipline;

    (async () => {
      const { textmode } = await import('textmode.js');
      if (disposed) return;
      const t = textmode.create({
        canvas,
        width: size,
        height: size,
        fontSize: FONT_SIZE,
        frameRate: 30,
        pixelDensity:
          typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
        seed: 'presence-mark',
      });
      scene.current = t;

      const grid = t.grid;
      const radius = grid ? Math.floor(Math.min(grid.cols, grid.rows) / 2) - 1 : 4;

      const drawStatic = (current: PresenceState) => {
        t.background(0, 0);
        for (const glyph of constellationFor(current, radius)) {
          t.push();
          t.translate(glyph.x, glyph.y);
          t.charColor(
            PRESENCE_GOLD[0],
            PRESENCE_GOLD[1],
            PRESENCE_GOLD[2],
            Math.round(glyph.ink * 255),
          );
          t.char(PRESENCE_GLYPHS[glyph.glyph]);
          t.point();
          t.pop();
        }
      };

      t.draw(() => {
        const current = stateRef.current;
        const frame = frameRef.current;
        frameRef.current += 1;

        if (reducedMotion || current === 'idle' || current === 'interrupted') {
          drawStatic(current);
          return;
        }

        if (current === 'acting') {
          // Convergence, oxblood commit flash, release back to sparse.
          t.background(0, 0);
          const anchors = constellationFor('acting', radius);
          if (frame < ACT_CONDENSE_FRAMES) {
            const progress = frame / ACT_CONDENSE_FRAMES;
            for (const glyph of anchors) {
              t.push();
              t.translate(
                Math.round(glyph.x * (1 - progress)),
                Math.round(glyph.y * (1 - progress)),
              );
              t.charColor(PRESENCE_GOLD[0], PRESENCE_GOLD[1], PRESENCE_GOLD[2], 220);
              t.char(PRESENCE_GLYPHS[glyph.glyph]);
              t.point();
              t.pop();
            }
          } else if (frame < ACT_CONDENSE_FRAMES + ACT_FLASH_FRAMES) {
            t.charColor(PRESENCE_OXBLOOD[0], PRESENCE_OXBLOOD[1], PRESENCE_OXBLOOD[2], 255);
            t.char(COMMIT_GLYPH);
            t.point();
          } else {
            const release = Math.min((frame - ACT_CONDENSE_FRAMES - ACT_FLASH_FRAMES) / 10, 1);
            for (const glyph of anchors) {
              t.push();
              t.translate(Math.round(glyph.x * release * 2.2), Math.round(glyph.y * release * 2.2));
              t.charColor(
                PRESENCE_GOLD[0],
                PRESENCE_GOLD[1],
                PRESENCE_GOLD[2],
                Math.round((1 - release * 0.6) * glyph.ink * 255),
              );
              t.char(PRESENCE_GLYPHS[glyph.glyph]);
              t.point();
              t.pop();
            }
          }
          return;
        }

        t.background(0, 0);
        const anchors = constellationFor(current, radius);
        for (const [index, glyph] of anchors.entries()) {
          t.push();
          if (current === 'moving') {
            // Directed stream: glyphs flow along x and wrap.
            const span = radius * 2;
            const offset = (glyph.x + radius + ((frame * 0.6 + index) % span)) % span;
            t.translate(Math.round(offset - radius), glyph.y);
          } else if (current === 'telegraphing') {
            // The ring holds; ink breathes slightly.
            t.translate(glyph.x, glyph.y);
          } else {
            // thinking: slow cycling in place.
            t.translate(glyph.x, glyph.y);
          }
          const cycle =
            current === 'thinking'
              ? (glyph.glyph + Math.floor(frame / 24)) % PRESENCE_GLYPHS.length
              : glyph.glyph;
          const breathe =
            current === 'telegraphing' ? 0.75 + 0.25 * Math.sin((frame + index * 5) / 9) : 1;
          t.charColor(
            PRESENCE_GOLD[0],
            PRESENCE_GOLD[1],
            PRESENCE_GOLD[2],
            Math.round(glyph.ink * breathe * 255),
          );
          t.char(PRESENCE_GLYPHS[cycle]);
          t.point();
          t.pop();
        }
      });

      applyLoopDiscipline();
    })().catch(() => {
      // textmode.js is WebGL2-only; if the dynamic import or context creation
      // fails the presence mark stays blank, matching the header contract
      // rather than surfacing an unhandled rejection.
    });

    return () => {
      disposed = true;
      if (shimmerTimer.current) clearInterval(shimmerTimer.current);
      scene.current?.destroy();
      scene.current = null;
    };
    // The scene mounts once per size; state changes flow through refs.
  }, [size]);

  useEffect(() => {
    applyLoopDisciplineRef.current?.();
  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${label}: ${state}`}
      style={{ width: size, height: size, pointerEvents: 'none', display: 'block' }}
    />
  );
}

export default PresenceMark;
