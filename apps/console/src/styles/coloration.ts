// SOURCING: SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS1.
// Paper and ink are separate OKLCH ladders with separate hue anchors.
// Ink hue is paper hue rotated 180 degrees; chroma is clamped hard.
// Warm paper, cool ink. Chroma falls as painted area (and lightness) grows.

export type Mode = 'dark' | 'light';

export type Ladder = { l: number; c: number; h: number };

/** Starting paper anchor for light mode (spec table). Tune against a display. */
export const DEFAULT_PAPER_ANCHOR = 62;

/** Default ink chroma clamp (body ink at or below 0.014). */
export const DEFAULT_INK_CHROMA_CLAMP = 0.014;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Paper: hue anchored warm (about 55 to 70), chroma falling as lightness rises,
 * hue torsion of about +2 per step toward the light end so the ramp reads as a
 * material rather than one tint at N opacities.
 *
 * step 0 = canvas field, higher steps climb toward raised / popovers in light
 * mode and descend toward raised in dark mode via the lightness tables.
 */
export function paper(step: number, mode: Mode, anchor: number): Ladder {
  const safeStep = clamp(Math.floor(step), 0, 4);
  const paperHue = hue(anchor + safeStep * 2);

  if (mode === 'light') {
    // Spec light table at anchor 62: canvas 66, sunken 64, lifted 68, raised 70, seam 62.
    const light: readonly Ladder[] = [
      { l: 0.966, c: 0.006, h: hue(anchor + 4) }, // canvas
      { l: 0.942, c: 0.008, h: hue(anchor + 2) }, // sunken
      { l: 0.988, c: 0.004, h: hue(anchor + 6) }, // lifted
      { l: 0.997, c: 0.003, h: hue(anchor + 8) }, // raised
      { l: 0.893, c: 0.010, h: hue(anchor) }, // seam
    ];
    const base = light[safeStep];
    return { l: base.l, c: Math.min(base.c, 0.008 + (safeStep === 4 ? 0.002 : 0)), h: base.h };
  }

  // Dark mode mirrors the lightness curve and keeps both hue anchors.
  const dark: readonly Ladder[] = [
    { l: 0.18, c: 0.006, h: paperHue }, // canvas / frame
    { l: 0.22, c: 0.008, h: hue(anchor) }, // sunken / editor
    { l: 0.26, c: 0.005, h: hue(anchor + 4) }, // lifted / chrome
    { l: 0.30, c: 0.004, h: hue(anchor + 6) }, // raised
    { l: 0.14, c: 0.010, h: hue(anchor) }, // seam (darker than both)
  ];
  return dark[safeStep];
}

/**
 * Ink: complement of the paper anchor, chroma clamped low.
 * Body / label / metadata steps stay on the cool side of the circle.
 */
export function ink(step: number, mode: Mode, anchor: number, chromaClamp = DEFAULT_INK_CHROMA_CLAMP): Ladder {
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

/** Named paper roles used by materials and the canvas fill. */
export function paperRoles(mode: Mode, anchor: number): {
  canvas: Ladder;
  sunken: Ladder;
  lifted: Ladder;
  raised: Ladder;
  seam: Ladder;
} {
  return {
    canvas: paper(0, mode, anchor),
    sunken: paper(1, mode, anchor),
    lifted: paper(2, mode, anchor),
    raised: paper(3, mode, anchor),
    seam: paper(4, mode, anchor),
  };
}

export function inkRoles(
  mode: Mode,
  anchor: number,
  chromaClamp = DEFAULT_INK_CHROMA_CLAMP,
): {
  primary: Ladder;
  secondary: Ladder;
  faint: Ladder;
} {
  return {
    primary: ink(0, mode, anchor, chromaClamp),
    secondary: ink(1, mode, anchor, chromaClamp),
    faint: ink(2, mode, anchor, chromaClamp),
  };
}

/** Guard: warm paper anchors that stay warm live on the orange side (55 to 70). */
export function clampPaperAnchor(anchor: number): number {
  // Allow the full hue circle for the slider, but bias green-drifting yellows
  // (near 78 at high L) are the user's problem to leave; the torsion + low
  // chroma keep identity. Soft-clamp only NaN.
  if (!Number.isFinite(anchor)) return DEFAULT_PAPER_ANCHOR;
  return hue(anchor);
}
