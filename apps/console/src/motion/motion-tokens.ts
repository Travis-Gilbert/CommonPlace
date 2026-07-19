// SOURCING: none. Pure logic, no upstream component applies.
/**
 * The console motion register (HANDOFF-GREENFIELD-CONSOLE G4). Ported from
 * SPEC-WORK-SURFACE-EXECUTION's motion register structure with Int UI values:
 * durations fast 160 / base 220 / slow 320, the register easing, stagger 40ms
 * capped at the first 5 items. This file is the only place a literal duration
 * may exist (scripts/check-motion-inventory.mjs enforces).
 *
 * Rules carried from the source spec:
 * 1. Transform and opacity only. Nothing animates width, height, top, left;
 *    panel splits are user-dragged geometry owned by react-resizable-panels.
 * 2. Entrances are interruptible; no animation gates input.
 * 3. Streaming text is sacred: no layout animation on the streaming container.
 * 4. Ambient motion lives only in the GroundCanvas layer behind the frame;
 *    chrome is still AT REST. Narrowed, on the record, by
 *    HANDOFF-CONSOLE-DIMENSIONALITY named choice 1: "ambient" means unprompted
 *    and always-on, which is the property that made the ground the only place
 *    for it. Paint that runs only while a named state is live is feedback, not
 *    ambience, and it stops when the state does. The composer sheen is that
 *    case and the only chrome exception: it draws once and holds still at idle,
 *    and opens a frame loop strictly while the agent is streaming ("breathes
 *    only while the agent works"). The rule's original flat reading had already
 *    been narrowed in practice by the reviewable half of this register --
 *    INTERACTION_INVENTORY has carried the composer, the Presence mark, and the
 *    status-bar sweep as non-ground surfaces since G4 -- so this paragraph
 *    writes down a narrowing that was previously implicit rather than granting
 *    a new one. DECLARED_PAINT_SURFACES below closes the matching gap in the
 *    mechanical half.
 * 5. prefers-reduced-motion renders settled and static: every duration maps
 *    to 0 and the ground stops repainting. No component implements its own
 *    reduced-motion branch outside useMotionDurations. "Static" means the
 *    surface still paints its resting frame; a removed surface is not a
 *    settled one.
 */

'use client';

import { useReducedMotion } from 'motion/react';
import { useShellStore } from '@/lib/shell-store';

export const DUR = {
  /** hover fades, exits, chip toggles */
  fast: 160,
  /** entrances: messages, tool cards, tool windows */
  base: 220,
  /** the whole load entrance budget; nothing exceeds it */
  slow: 320,
} as const;

/** The register easing (int-ui-register.css --ij-ease), as a motion-style array. */
export const EASE_OUT: readonly [number, number, number, number] = [0.2, 0, 0, 1];

export const STAGGER = {
  /** per-item delay for multi-item entrances */
  step: 40,
  /** stagger applies to at most the first N items; the remainder batch */
  cap: 5,
} as const;

/** Staggered delay in ms for item `index`, capped per the register. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER.cap - 1) * STAGGER.step;
}

/** GroundCanvas pacing: one quiet repaint tick; the only ambient motion. */
export const GROUND = {
  /** ms between ambient repaints; slow enough to be negligible at idle */
  tickMs: 240,
  /** drift per tick in device pixels; quiet by construction */
  drift: 0.18,
} as const;

/** Presence mark pacing (G7): glyph cycle and the commit flash. */
export const MARK = {
  idleCycleMs: 1400,
  composeCycleMs: 420,
  commitFlashMs: 160,
} as const;

/**
 * The interaction inventory. Every animation on the surface appears here;
 * anything animating that is not on this list is a defect (G4). The scan
 * enforces the mechanical half (no animation declarations outside this file
 * and the register); this table is the reviewable half.
 */
export const INTERACTION_INVENTORY = [
  {
    trigger: 'Route load',
    effect: 'Tool windows and toolbar materialize: opacity 0 to 1 plus 4px translate, staggered by stripe order, inside 320ms total; editor content fades in after chrome settles',
    spec: 'DUR.base per element, staggerDelay by stripe order, EASE_OUT, total <= DUR.slow',
    reducedMotion: 'renders settled and static, no entrance',
  },
  {
    trigger: 'Tool window opened or closed',
    effect: 'panel content fade + 4px translate',
    spec: 'DUR.fast, EASE_OUT; the split geometry itself never animates',
    reducedMotion: 'instant',
  },
  {
    trigger: 'Editor tab switched',
    effect: 'incoming pane opacity fade',
    spec: 'DUR.fast, EASE_OUT',
    reducedMotion: 'instant',
  },
  {
    trigger: 'Search panel expand/collapse',
    effect: 'scale 0.98 to 1 plus fade below the toolbar',
    spec: 'DUR.fast open, EASE_OUT',
    reducedMotion: 'expansion renders as a plain fade (R1 acceptance), no scale',
  },
  {
    trigger: 'Action sheet opens',
    effect: 'scale 0.98 to 1 plus fade on the composer material at reduced scale',
    spec: 'DUR.fast, EASE_OUT',
    reducedMotion: 'renders without the material animation (K3 acceptance): plain fade, no scale',
  },
  {
    trigger: 'Thread message appears',
    effect: 'opacity 0 to 1, y 6 to 0',
    spec: 'DUR.base, EASE_OUT; streaming text container never participates in layout animation',
    reducedMotion: 'instant',
  },
  {
    trigger: 'Composer run state changes',
    effect: 'low-chroma material wash gains slight strength while streaming and flashes gold once on commit',
    spec: 'idle draws once; streaming requestAnimationFrame loop only; commit uses DUR.fast',
    reducedMotion: 'static low-chroma sheen, no frame loop or flash',
  },
  {
    trigger: 'Tool card appears in thread',
    effect: 'opacity + y 8 to 0',
    spec: 'DUR.base, EASE_OUT, staggerDelay when multiple',
    reducedMotion: 'instant',
  },
  {
    trigger: 'Record row / clickable hover',
    effect: 'background only',
    spec: 'var(--rec-clickable-transition): background 0.1s ease (the Twenty rule)',
    reducedMotion: 'same; a background color change is not motion',
  },
  {
    trigger: 'Run state change (RunWidget)',
    effect: 'color swap to --ij-running',
    spec: 'instant color set; no pulse, no spin',
    reducedMotion: 'same',
  },
  {
    trigger: 'Status bar indeterminate progress',
    effect: 'Blue9 to Blue5 gradient sweep on the progress track',
    spec: 'CSS keyframes in this register only, GROUND-quiet; one ambient max per viewport shared with the ground',
    reducedMotion: 'static two-tone bar',
  },
  {
    trigger: 'Goal Stack task runs',
    effect: 'the completed segment of the inbound React Flow edge marches toward the task',
    spec: 'CSS keyframes in the motion register only; edge geometry and node positions remain still',
    reducedMotion: 'solid completed segment with no dash movement',
  },
  {
    trigger: 'Presence mark states',
    effect: 'glyph constellation cycling (idle, composing), condensation with accent commit flash (acting), settle within one frame (interrupted)',
    spec: 'MARK tokens; canvas drawing, not CSS; never intercepts pointer events',
    reducedMotion: 'static constellation per state, no cycling',
  },
  {
    trigger: 'Ground ambient',
    effect: 'quiet register-derived texture drift on the GroundCanvas behind the frame',
    spec: 'GROUND tokens; the only permitted ambient motion; never repaints above a measured negligible idle cost',
    reducedMotion: 'static texture, no repaint loop',
  },
  {
    trigger: 'Filing correction accepted',
    effect: 'the undo toast arrives at the foot of the Index: opacity 0 to 1 plus 4px translate, then stands for its window and leaves',
    spec: 'DUR.fast, EASE_OUT, transform and opacity only; the toast is time-boxed by the undo window, not by the animation',
    reducedMotion: 'the toast renders settled and static, and still stands for its full undo window',
  },
] as const;

/**
 * The declared paint surfaces (HANDOFF-CONSOLE-DIMENSIONALITY, motion-gate
 * reconciliation). A canvas that obtains a rendering context and drives its own
 * frame loop is invisible to the textual half of the scan: it declares no CSS
 * animation, no @keyframes, and no literal duration, so it would merge
 * undeclared. That was the one real hole in gate 4, and it is the hole rule 4
 * exists to cover. Every such surface is named here with the inventory row that
 * reviews it; scripts/check-motion-inventory.mjs fails on any file that paints
 * a canvas in a frame loop without appearing on this list.
 *
 * Paths are app-relative. Adding one is a reviewed diff, exactly as adding a
 * register token is.
 */
export const DECLARED_PAINT_SURFACES = [
  {
    file: 'src/components/ground/GroundCanvas.tsx',
    inventory: 'Ground ambient',
    reason: 'the one permitted ambient surface; sits behind the frame, not in chrome',
  },
  {
    file: 'src/components/mark/PresenceMark.tsx',
    inventory: 'Presence mark states',
    reason: 'the agent identity glyph; canvas drawing per the inventory, never intercepts pointer events',
  },
  {
    file: 'src/components/composer/ComposerSheenCanvas.tsx',
    inventory: 'Composer run state changes',
    reason: 'the composer instrument sheen; static at idle, frame loop strictly while streaming (rule 4 narrowing)',
  },
] as const;

export interface MotionDurations {
  fast: number;
  base: number;
  slow: number;
  reduced: boolean;
}

/** The one reduced-motion branch in the app: token durations collapse to 0.
 *  The Command-mode preview toggle (R1) overlays the media query so reduced
 *  rendering is inspectable without flipping the OS setting. */
export function useMotionDurations(): MotionDurations {
  const media = useReducedMotion() ?? false;
  const preview = useShellStore((state) => state.reducedMotionPreview);
  const reduced = media || preview;
  if (reduced) return { fast: 0, base: 0, slow: 0, reduced: true };
  return { ...DUR, reduced: false };
}

/** Seconds form for motion/react transition props. */
export function seconds(ms: number): number {
  return ms / 1000;
}
