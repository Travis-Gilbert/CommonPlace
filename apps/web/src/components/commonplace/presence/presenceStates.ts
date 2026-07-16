/**
 * Presence mark state definitions (SPEC-UI-SOURCING-ADDENDUM, Presence D1/D3).
 *
 * Pure data plus pure functions: the live textmode.js scene, the reduced-motion
 * static rendering, and the brand asset export all draw from these same
 * definitions, so the exported glyph set cannot drift from the product mark.
 *
 * Form: a compact character constellation, low-density glyphs, gold ink.
 * Oxblood appears only as the condensation flash at the instant an action
 * commits. Choreography (flow, orbit, convergence) is computed by hand; pts is
 * a motion reference only and is not shipped.
 */

export type PresenceState =
  | 'idle'
  | 'moving'
  | 'telegraphing'
  | 'acting'
  | 'thinking'
  | 'interrupted';

export const PRESENCE_STATES: readonly PresenceState[] = [
  'idle',
  'moving',
  'telegraphing',
  'acting',
  'thinking',
  'interrupted',
];

/** Low-density marks, sparsest first; the cycle wanders through them slowly. */
export const PRESENCE_GLYPHS = ['.', ',', ':', ';', '*', '+', '~', "'"] as const;

/** The solid glyph the constellation condenses into when an action commits. */
export const COMMIT_GLYPH = '@';

/** Gold ink (the register's learned-something channel). */
export const PRESENCE_GOLD: [number, number, number] = [196, 154, 74];
/** Oxblood, used only for the commit flash. */
export const PRESENCE_OXBLOOD: [number, number, number] = [122, 39, 51];

export interface PresenceGlyph {
  /** Cell offsets from the grid center. */
  x: number;
  y: number;
  /** Index into PRESENCE_GLYPHS. */
  glyph: number;
  /** 0..1 ink strength. */
  ink: number;
}

/** Deterministic small PRNG so every render of a state is the same form. */
function lcg(seed: number): () => number {
  let value = seed >>> 0 || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

export const CONSTELLATION_SIZE = 12;

/**
 * The static constellation for a state: what reduced motion renders, what the
 * export emits, and the anchor arrangement the live choreography moves through.
 * Distinct per state so a still image still reads as a state.
 */
export function constellationFor(state: PresenceState, radiusCells: number): PresenceGlyph[] {
  const seed = 7 + PRESENCE_STATES.indexOf(state) * 101;
  const random = lcg(seed);
  const glyphs: PresenceGlyph[] = [];

  for (let index = 0; index < CONSTELLATION_SIZE; index += 1) {
    const angle = (index / CONSTELLATION_SIZE) * Math.PI * 2 + random() * 0.7;
    let distance: number;
    switch (state) {
      case 'telegraphing':
        // A held ring around the target region.
        distance = radiusCells * 0.85;
        break;
      case 'acting':
        // Condensed toward the center; the flash happens live.
        distance = radiusCells * (0.15 + random() * 0.2);
        break;
      case 'moving':
        // Stretched into a directed stream.
        distance = radiusCells * (0.2 + (index / CONSTELLATION_SIZE) * 0.8);
        break;
      case 'interrupted':
        // Settled: a still, slightly tighter scatter.
        distance = radiusCells * (0.3 + random() * 0.35);
        break;
      default:
        // idle and thinking: sparse scatter.
        distance = radiusCells * (0.25 + random() * 0.65);
    }
    const x =
      state === 'moving'
        ? distance - radiusCells * 0.5
        : Math.cos(angle) * distance;
    const y =
      state === 'moving'
        ? (random() - 0.5) * radiusCells * 0.8
        : Math.sin(angle) * distance;
    glyphs.push({
      x: Math.round(x),
      y: Math.round(y),
      glyph: Math.floor(random() * PRESENCE_GLYPHS.length),
      ink: state === 'interrupted' ? 0.55 : 0.45 + random() * 0.5,
    });
  }
  return glyphs;
}

/** True when the state animates; idle runs only a slow shimmer tick. */
export function isAnimated(state: PresenceState): boolean {
  return state === 'moving' || state === 'telegraphing' || state === 'acting' || state === 'thinking';
}
