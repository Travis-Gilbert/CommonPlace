// SOURCING: apps/console/src/styles/coloration.ts (CS1 paper and ink ladders),
// apps/console/src/styles/geometry.css (CS2 radius law, CS3 three materials),
// apps/console/src/styles/theme-engine.ts (the chroma clamp bands).
//
// The CommonPlace token model, vendored into the fork so this package carries
// no back-dependency on apps/console. This file is the fork's only source of
// styling truth. Nothing else in the package may name a color.
//
// Two kinds of value leave this module:
//
//   1. `reg(...)` references. Every slot the console register already names
//      (surfaces, ink, accent, status, materials, radius) resolves to a
//      `var(--ij-*)` reference, never a snapshot. Light and dark, the two-knob
//      theme engine, and the Primer presets therefore reach fork components
//      without the fork knowing they exist.
//   2. Derived OKLCH literals. The 25-name record palette is a namespace the
//      console register does not carry, so it is generated here from the same
//      OKLCH model under the same chroma clamp. No upstream color value is
//      involved in either path.

export type Mode = 'dark' | 'light';

export type Ladder = { l: number; c: number; h: number };

/** Starting paper anchor for light mode (console CS1 table). */
export const DEFAULT_PAPER_ANCHOR = 62;

/** Default ink chroma clamp (body ink at or below 0.014). */
export const DEFAULT_INK_CHROMA_CLAMP = 0.014;

/** Neutral tint ceiling per mode, from the console's two-knob engine. */
export const TINT_CHROMA_CEILING: Readonly<Record<Mode, number>> = {
  dark: 0.03,
  light: 0.02,
};

/** Accent chroma band, from the console's two-knob engine. */
export const ACCENT_CHROMA_BAND = { min: 0.04, max: 0.12 } as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function hue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Paper: hue anchored warm (about 55 to 70), chroma falling as lightness rises,
 * hue torsion of about +2 per step toward the light end so the ramp reads as a
 * material rather than one tint at N opacities.
 */
export function paper(step: number, mode: Mode, anchor: number): Ladder {
  const safeStep = clamp(Math.floor(step), 0, 4);
  const paperHue = hue(anchor + safeStep * 2);

  if (mode === 'light') {
    const light: readonly Ladder[] = [
      { l: 0.966, c: 0.006, h: hue(anchor + 4) }, // canvas
      { l: 0.942, c: 0.008, h: hue(anchor + 2) }, // sunken
      { l: 0.988, c: 0.004, h: hue(anchor + 6) }, // lifted
      { l: 0.997, c: 0.003, h: hue(anchor + 8) }, // raised
      { l: 0.893, c: 0.01, h: hue(anchor) }, // seam
    ];
    const base = light[safeStep];
    return {
      l: base.l,
      c: Math.min(base.c, 0.008 + (safeStep === 4 ? 0.002 : 0)),
      h: base.h,
    };
  }

  const dark: readonly Ladder[] = [
    { l: 0.18, c: 0.006, h: paperHue }, // canvas / frame
    { l: 0.22, c: 0.008, h: hue(anchor) }, // sunken / editor
    { l: 0.26, c: 0.005, h: hue(anchor + 4) }, // lifted / chrome
    { l: 0.3, c: 0.004, h: hue(anchor + 6) }, // raised
    { l: 0.14, c: 0.01, h: hue(anchor) }, // seam (darker than both)
  ];
  return dark[safeStep];
}

/**
 * Ink: complement of the paper anchor, chroma clamped low.
 * Ink hue is paper hue rotated 180 degrees. Warm paper, cool ink.
 */
export function ink(
  step: number,
  mode: Mode,
  anchor: number,
  chromaClamp = DEFAULT_INK_CHROMA_CLAMP,
): Ladder {
  const safeStep = clamp(Math.floor(step), 0, 2);
  const inkHue = hue(anchor + 180);
  const clampC = Math.min(chromaClamp, 0.014);

  if (mode === 'light') {
    const light: readonly Ladder[] = [
      { l: 0.235, c: Math.min(0.013, clampC), h: inkHue }, // primary
      { l: 0.455, c: Math.min(0.011, clampC), h: inkHue }, // secondary
      { l: 0.615, c: Math.min(0.008, clampC), h: inkHue }, // faint
    ];
    return light[safeStep];
  }

  const dark: readonly Ladder[] = [
    { l: 0.88, c: Math.min(0.013, clampC), h: inkHue }, // primary
    { l: 0.68, c: Math.min(0.011, clampC), h: inkHue }, // secondary
    { l: 0.52, c: Math.min(0.008, clampC), h: inkHue }, // faint
  ];
  return dark[safeStep];
}

/** The first derived family: named paper roles used by materials and canvas. */
export function paperRoles(mode: Mode, anchor = DEFAULT_PAPER_ANCHOR) {
  return {
    canvas: paper(0, mode, anchor),
    sunken: paper(1, mode, anchor),
    lifted: paper(2, mode, anchor),
    raised: paper(3, mode, anchor),
    seam: paper(4, mode, anchor),
  };
}

/** The second derived family: named ink roles. */
export function inkRoles(
  mode: Mode,
  anchor = DEFAULT_PAPER_ANCHOR,
  chromaClamp = DEFAULT_INK_CHROMA_CLAMP,
) {
  return {
    primary: ink(0, mode, anchor, chromaClamp),
    secondary: ink(1, mode, anchor, chromaClamp),
    faint: ink(2, mode, anchor, chromaClamp),
  };
}

/** Serialize an OKLCH ladder entry to a CSS color value. */
export function oklch({ l, c, h }: Ladder): string {
  return `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${h.toFixed(1)})`;
}

/** Reference a console register token. The fork never snapshots one. */
export function reg(token: string): string {
  return `var(--ij-${token})`;
}

/** Reference a console register token with a fallback expression. */
export function regOr(token: string, fallback: string): string {
  return `var(--ij-${token}, ${fallback})`;
}

/** Reference a console structural token (the Twenty proportions group). */
export function rec(token: string): string {
  return `var(--rec-${token})`;
}

// ---------------------------------------------------------------------------
// The radius law (console CS2 geometry.css)
//
// Radii below roughly three device pixels of arc antialias into a chipped
// square, so the scale floors at 4. Round, not squircle: the MaterialLayer SDF
// draws circular rounded rects behind each island, and a squircle DOM clip over
// a circular shader corner is the doubled-corner halo.
// ---------------------------------------------------------------------------

export const RADIUS = {
  /** tags, counts, status pills */
  chip: 'var(--radius-chip, 4px)',
  /** buttons, inputs, segmented controls */
  control: 'var(--radius-control, 7px)',
  /** inset blocks */
  sunken: 'var(--radius-sunken, 10px)',
  /** floating blocks: one scale with the SDF */
  lifted: 'var(--radius-lifted, var(--ij-radius-lg))',
  xs: reg('radius-xs'),
  sm: reg('radius-sm'),
  md: reg('radius-md'),
  lg: reg('radius-lg'),
  xl: reg('radius-xl'),
  pill: '999px',
  rounded: '100%',
} as const;

/** The console's corner-shape ruling. Not a knob the fork may turn. */
export const CORNER_SHAPE = 'round';

// ---------------------------------------------------------------------------
// The three materials (console CS3 geometry.css)
//
// Sunken, lifted, docked. Depth budget: blur never exceeds 6px, y-offset never
// exceeds 1px. IDE chrome gets depth from tone difference; shadow only confirms
// a boundary tone already made.
// ---------------------------------------------------------------------------

export const MATERIALS = {
  sunken: {
    background: 'var(--fill-sunken, var(--ij-editor))',
    border: regOr('seam', 'transparent'),
    shadow: 'inset 0 0 0 1px var(--paper-seam, var(--ij-seam))',
    radius: RADIUS.sunken,
  },
  lifted: {
    background: 'var(--fill-lifted, var(--ij-chrome))',
    border: reg('keyline'),
    shadow: 'var(--shadow-lifted, 0 1px 2px rgb(0 0 0 / 0.04), 0 1px 6px rgb(0 0 0 / 0.03))',
    radius: RADIUS.lifted,
  },
  docked: {
    background: 'var(--fill-lifted, var(--ij-chrome))',
    border: reg('divider'),
    shadow: 'var(--shadow-docked-right, -1px 0 3px rgb(0 0 0 / 0.04))',
    radius: RADIUS.lifted,
  },
} as const;

// ---------------------------------------------------------------------------
// The record palette namespace.
//
// twenty-ui addresses record tag and chip color by 25 hue names. The console
// register does not carry that namespace, so it is derived here from the same
// OKLCH model: one hue anchor per name, the shared lightness ladder, chroma
// held inside ACCENT_CHROMA_BAND. Where the console already owns a hue, the
// anchor is that register token's hue so the two systems agree by construction.
// ---------------------------------------------------------------------------

export type ThemeColorName =
  | 'gray' | 'mauve' | 'slate' | 'sage' | 'olive' | 'sand'
  | 'tomato' | 'red' | 'ruby' | 'crimson' | 'pink' | 'plum'
  | 'purple' | 'violet' | 'iris' | 'blue' | 'cyan' | 'turquoise'
  | 'sky' | 'mint' | 'jade' | 'green' | 'grass' | 'lime'
  | 'yellow' | 'amber' | 'orange' | 'brown' | 'bronze' | 'gold';

/** Hue anchor per palette name, in OKLCH degrees. */
export const PALETTE_HUES: Readonly<Record<ThemeColorName, number>> = {
  gray: 0,
  mauve: 300,
  slate: 260,
  sage: 160,
  olive: 120,
  sand: 80,
  tomato: 35,
  red: 25,
  ruby: 12,
  crimson: 0,
  pink: 350,
  plum: 330,
  purple: 310,
  violet: 295,
  iris: 275,
  blue: 258,
  cyan: 220,
  turquoise: 195,
  sky: 235,
  mint: 175,
  jade: 165,
  green: 150,
  grass: 140,
  lime: 125,
  yellow: 100,
  amber: 85,
  orange: 60,
  brown: 55,
  bronze: 45,
  gold: 90,
};

/** Names that read as neutral tints: chroma stays under the tint ceiling. */
export const NEUTRAL_TINT_NAMES: readonly ThemeColorName[] = [
  'gray', 'mauve', 'slate', 'sage', 'olive', 'sand',
];

/**
 * Radix-compatible 12-step semantics: 1 to 2 page backgrounds, 3 to 5 component
 * backgrounds, 6 to 8 borders, 9 to 10 solid fills, 11 to 12 text. The ladder
 * runs background to foreground in both modes, which is why the physical
 * lightness direction inverts between them.
 */
const LIGHTNESS_LADDER: Readonly<Record<Mode, readonly number[]>> = {
  dark: [0.18, 0.21, 0.25, 0.28, 0.32, 0.36, 0.41, 0.49, 0.58, 0.63, 0.77, 0.9],
  light: [0.99, 0.975, 0.95, 0.92, 0.89, 0.86, 0.82, 0.74, 0.63, 0.58, 0.47, 0.28],
};

/** Chroma rises to the solid steps and falls back at both ends. */
const CHROMA_CURVE: readonly number[] = [
  0.15, 0.25, 0.45, 0.6, 0.72, 0.82, 0.92, 1.0, 1.0, 0.98, 0.8, 0.45,
];

/** Alpha ladder for the transparent palette, mirroring the chroma curve. */
const ALPHA_LADDER: readonly number[] = [
  0.03, 0.06, 0.09, 0.12, 0.16, 0.2, 0.26, 0.34, 0.44, 0.5, 0.62, 0.86,
];

/** One derived palette shade. `step` is 1-indexed to match the upstream keys. */
export function paletteShade(
  name: ThemeColorName,
  step: number,
  mode: Mode,
): string {
  const index = clamp(Math.floor(step), 1, 12) - 1;
  const isNeutralTint = NEUTRAL_TINT_NAMES.includes(name);
  const ceiling = isNeutralTint
    ? TINT_CHROMA_CEILING[mode]
    : ACCENT_CHROMA_BAND.max;
  const floor = isNeutralTint ? 0 : ACCENT_CHROMA_BAND.min * CHROMA_CURVE[index];
  const chroma = Math.max(floor, ceiling * CHROMA_CURVE[index]);
  return oklch({
    l: LIGHTNESS_LADDER[mode][index],
    c: name === 'gray' ? 0 : chroma,
    h: PALETTE_HUES[name],
  });
}

/** The transparent variant of a derived palette shade. */
export function paletteShadeAlpha(
  name: ThemeColorName,
  step: number,
  mode: Mode,
): string {
  const index = clamp(Math.floor(step), 1, 12) - 1;
  const solid = paletteShade(name, step, mode);
  return `color-mix(in oklab, ${solid} ${(ALPHA_LADDER[index] * 100).toFixed(1)}%, transparent)`;
}

/**
 * The console register slot a palette name maps onto when the console owns that
 * hue. Used for the tag surfaces the records surface already paints, so a fork
 * Tag and a console row tint cannot drift.
 */
export const REGISTER_HUE_SLOTS: Readonly<
  Partial<Record<ThemeColorName, { readonly tint: string; readonly ink: string }>>
> = {
  gray: { tint: reg('row-gray'), ink: reg('ink-info') },
  blue: { tint: reg('row-blue'), ink: reg('link') },
  green: { tint: reg('ok-bg'), ink: reg('ok') },
  red: { tint: reg('error-bg'), ink: reg('error') },
  orange: { tint: reg('row-orange'), ink: reg('agent') },
  yellow: { tint: reg('warn-bg'), ink: reg('warn') },
  purple: { tint: reg('room-tint'), ink: reg('room') },
  violet: { tint: reg('row-violet'), ink: reg('room') },
  turquoise: { tint: reg('graph-tint'), ink: reg('graph') },
  gold: { tint: reg('gold-tint'), ink: reg('gold') },
  pink: { tint: reg('row-rose'), ink: reg('error') },
  // The harness domain accents. The console paints memory green, agent amber,
  // rooms purple, graph teal; jade and amber are the palette names those two
  // land on so a fork Tag and a console domain tint are the same paint.
  jade: { tint: reg('memory-tint'), ink: reg('memory') },
  amber: { tint: reg('agent-tint'), ink: reg('agent') },
};
