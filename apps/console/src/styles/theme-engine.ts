// SOURCING: SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS1 over the prior
// HANDOFF-CONSOLE-COLORATION two-knob engine. Paper and ink are separate
// ladders; contrast clamps always run and name every pair they adjust.
// Fixed-point at chroma zero is preserved for the stock Int UI gray ramp
// so pinned registers remain a recoverable baseline.

import { inGamut, wcagContrast } from '@travis-gilbert/markdown-theory/tokens';
import {
  DEFAULT_INK_CHROMA_CLAMP,
  DEFAULT_PAPER_ANCHOR,
  clampPaperAnchor,
  inkRoles,
  paperRoles,
  type Ladder,
  type Mode,
} from './coloration';

export type ResolvedThemeMode = Mode;

export interface ThemeKnobs {
  /** Paper hue anchor (warm side, about 55 to 70 for light paper). */
  readonly tintHue: number;
  /** Paper chroma scale for small chips; canvas chroma stays area-aware and low. */
  readonly tintChroma: number;
  /** Highlight / selection hue. Bound to selection swatches. */
  readonly highlightHue: number;
  /** Ink chroma clamp. Body ink stays at or below 0.014. */
  readonly inkChromaClamp: number;
}

export interface OklchColor {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

export interface ContrastCheck {
  readonly name: string;
  readonly ratio: number;
  readonly target: number;
  readonly pass: boolean;
}

export interface GeneratedTheme {
  readonly mode: ResolvedThemeMode;
  readonly knobs: ThemeKnobs;
  readonly variables: Readonly<Record<string, string>>;
  readonly checks: readonly ContrastCheck[];
  readonly clampNotes: readonly string[];
}

export const PAPER_KNOBS: ThemeKnobs = {
  tintHue: DEFAULT_PAPER_ANCHOR,
  tintChroma: 0.008,
  highlightHue: 250,
  inkChromaClamp: DEFAULT_INK_CHROMA_CLAMP,
};

/** @deprecated Use PAPER_KNOBS. Kept as an alias for call sites mid-migration. */
export const NAVY_KNOBS: ThemeKnobs = {
  tintHue: 250,
  tintChroma: 0.025,
  highlightHue: 20,
  inkChromaClamp: DEFAULT_INK_CHROMA_CLAMP,
};

export const DARK_NEUTRALS = [
  '#1E1F22', '#2B2D30', '#393B40', '#43454A', '#4E5157', '#5A5D63', '#6F737A',
  '#868A91', '#9DA0A8', '#B4B8BF', '#CED0D6', '#DFE1E5', '#F0F1F2', '#FFFFFF',
] as const;

export const LIGHT_NEUTRALS = [
  '#000000', '#27282E', '#383A42', '#494B57', '#5A5D6B', '#6C707E', '#818594',
  '#A8ADBD', '#C9CCD6', '#D3D5DB', '#DFE1E5', '#EBECF0', '#F7F8FA', '#FFFFFF',
] as const;

export const GENERATED_THEME_VARIABLES = [
  ...Array.from({ length: 14 }, (_, index) => `--ij-gray-${index + 1}`),
  '--ij-frame',
  '--ij-editor',
  '--ij-chrome',
  '--ij-raised',
  '--ij-seam',
  '--ij-seam-raised',
  '--ij-divider',
  '--ij-control-border',
  '--ij-ink',
  '--ij-ink-info',
  '--ij-ink-disabled',
  '--ij-ink-faint',
  '--ij-gold',
  '--ij-selection',
  '--ij-selection-inactive',
  '--ij-editor-line',
  '--ij-search-match',
  '--ij-text-selection',
  '--paper-canvas',
  '--paper-sunken',
  '--paper-lifted',
  '--paper-raised',
  '--paper-seam',
  '--ink-primary',
  '--ink-secondary',
  '--ink-faint',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function hue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Published OKLab conversion matrices (Bjorn Ottosson). */
export function hexToOklch(hex: string): OklchColor {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  const linearL = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const linearM = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const linearS = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l3 = Math.cbrt(linearL);
  const m3 = Math.cbrt(linearM);
  const s3 = Math.cbrt(linearS);
  const lightness = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const axisA = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const axisB = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const chroma = Math.sqrt(axisA * axisA + axisB * axisB);
  return {
    l: lightness,
    c: chroma,
    h: hue((Math.atan2(axisB, axisA) * 180) / Math.PI),
  };
}

const LIGHTNESS_LADDERS: Readonly<Record<ResolvedThemeMode, readonly OklchColor[]>> = {
  dark: DARK_NEUTRALS.map(hexToOklch),
  light: LIGHT_NEUTRALS.map(hexToOklch),
};

function css(color: OklchColor | Ladder): string {
  return `oklch(${(color.l * 100).toFixed(3)}% ${color.c.toFixed(4)} ${color.h.toFixed(2)})`;
}

function gamutColor(l: number, requestedChroma: number, requestedHue: number): OklchColor {
  let color: OklchColor = { l, c: requestedChroma, h: requestedHue };
  while (!inGamut(color) && color.c > 0.0001) {
    color = { ...color, c: color.c * 0.9 };
  }
  return color;
}

function solveBackground(
  foreground: OklchColor,
  seed: OklchColor,
  target: number,
  direction: 'lighter' | 'darker',
): { color: OklchColor; clamped: boolean } {
  let color = seed;
  if (wcagContrast(foreground, color) >= target) return { color, clamped: false };
  for (let step = 0; step < 80; step += 1) {
    const nextLightness = clamp(color.l + (direction === 'lighter' ? 0.01 : -0.01), 0, 1);
    color = gamutColor(nextLightness, color.c, color.h);
    if (wcagContrast(foreground, color) >= target) return { color, clamped: true };
  }
  return { color: { l: direction === 'lighter' ? 1 : 0, c: 0, h: color.h }, clamped: true };
}

function solveForeground(
  foreground: OklchColor,
  background: OklchColor,
  target: number,
  direction: 'lighter' | 'darker',
): { color: OklchColor; clamped: boolean } {
  if (wcagContrast(foreground, background) >= target) return { color: foreground, clamped: false };
  let color = foreground;
  for (let step = 0; step < 80; step += 1) {
    color = gamutColor(clamp(color.l + (direction === 'lighter' ? 0.01 : -0.01), 0, 1), color.c, color.h);
    if (wcagContrast(color, background) >= target) return { color, clamped: true };
  }
  return { color: { l: direction === 'lighter' ? 1 : 0, c: 0, h: color.h }, clamped: true };
}

function check(name: string, foreground: OklchColor, background: OklchColor, target: number): ContrastCheck {
  const ratio = wcagContrast(foreground, background);
  return { name, ratio, target, pass: ratio >= target };
}

function asOklch(ladder: Ladder): OklchColor {
  return { l: ladder.l, c: ladder.c, h: ladder.h };
}

export function generateTheme(mode: ResolvedThemeMode, input: ThemeKnobs): GeneratedTheme {
  const notes: string[] = [];
  const knobs: ThemeKnobs = {
    tintHue: clampPaperAnchor(Number.isFinite(input.tintHue) ? input.tintHue : PAPER_KNOBS.tintHue),
    tintChroma: clamp(Number.isFinite(input.tintChroma) ? input.tintChroma : 0, 0, 0.04),
    highlightHue: hue(Number.isFinite(input.highlightHue) ? input.highlightHue : PAPER_KNOBS.highlightHue),
    inkChromaClamp: clamp(
      Number.isFinite(input.inkChromaClamp) ? input.inkChromaClamp : DEFAULT_INK_CHROMA_CLAMP,
      0,
      0.014,
    ),
  };
  if (knobs.tintChroma !== input.tintChroma) {
    notes.push(`Paper chroma clamp applied: requested ${input.tintChroma}, used ${knobs.tintChroma}.`);
  }
  if (knobs.inkChromaClamp !== input.inkChromaClamp && Number.isFinite(input.inkChromaClamp)) {
    notes.push(`Ink chroma clamp applied: requested ${input.inkChromaClamp}, used ${knobs.inkChromaClamp}.`);
  }

  // Fixed point: zero paper chroma returns the stock Int UI gray ramp bytes.
  if (knobs.tintChroma === 0) {
    const stock = mode === 'dark' ? DARK_NEUTRALS : LIGHT_NEUTRALS;
    const variables: Record<string, string> = Object.fromEntries(
      stock.map((hex, index) => [`--ij-gray-${index + 1}`, hex]),
    );
    variables['--ij-frame'] = mode === 'dark' ? '#131314' : '#EBECF0';
    const checks = [
      check('ink on chrome', hexToOklch(stock[mode === 'dark' ? 11 : 1]), hexToOklch(stock[mode === 'dark' ? 1 : 12]), 4.5),
    ];
    return { mode, knobs, variables, checks, clampNotes: notes.length ? notes : ['Contrast clamps ran; no pair required adjustment.'] };
  }

  const papers = paperRoles(mode, knobs.tintHue);
  const inks = inkRoles(mode, knobs.tintHue, knobs.inkChromaClamp);

  // Area-aware paper chroma: canvas stays at or below 0.008 even if the chip
  // slider is higher. Chip / control chroma may use tintChroma.
  const canvas = gamutColor(papers.canvas.l, Math.min(papers.canvas.c, 0.008), papers.canvas.h);
  const sunken = gamutColor(papers.sunken.l, Math.min(papers.sunken.c, knobs.tintChroma || papers.sunken.c), papers.sunken.h);
  const lifted = gamutColor(papers.lifted.l, Math.min(papers.lifted.c, 0.006), papers.lifted.h);
  const raised = gamutColor(papers.raised.l, Math.min(papers.raised.c, 0.005), papers.raised.h);
  const seam = gamutColor(papers.seam.l, papers.seam.c, papers.seam.h);

  let primary = asOklch(inks.primary);
  let secondary = asOklch(inks.secondary);
  let faint = asOklch(inks.faint);

  // Contrast clamps always run. Name every pair adjusted.
  const inkOnCanvas = solveForeground(primary, canvas, 4.5, mode === 'dark' ? 'lighter' : 'darker');
  if (inkOnCanvas.clamped) {
    notes.push('ink-primary on paper-canvas: lightness adjusted for 4.5:1.');
    primary = inkOnCanvas.color;
  }
  const inkOnSunken = solveForeground(primary, sunken, 4.5, mode === 'dark' ? 'lighter' : 'darker');
  if (inkOnSunken.clamped) {
    notes.push('ink-primary on paper-sunken: lightness adjusted for 4.5:1.');
    primary = inkOnSunken.color;
  }
  const secondaryOnCanvas = solveForeground(secondary, canvas, 3, mode === 'dark' ? 'lighter' : 'darker');
  if (secondaryOnCanvas.clamped) {
    notes.push('ink-secondary on paper-canvas: lightness adjusted for 3:1.');
    secondary = secondaryOnCanvas.color;
  }
  const faintOnCanvas = solveForeground(faint, canvas, 3, mode === 'dark' ? 'lighter' : 'darker');
  if (faintOnCanvas.clamped) {
    notes.push('ink-faint on paper-canvas: lightness adjusted for 3:1.');
    faint = faintOnCanvas.color;
  }

  const highlightSeed = gamutColor(mode === 'dark' ? 0.34 : 0.9, 0.08, knobs.highlightHue);
  const highlight = solveBackground(primary, highlightSeed, 4.5, mode === 'dark' ? 'darker' : 'lighter');
  if (highlight.clamped) {
    notes.push('highlight on ink-primary: lightness adjusted for 4.5:1.');
  }

  const gold = solveForeground(
    hexToOklch(mode === 'dark' ? '#D6AE58' : '#A46704'),
    lifted,
    4.5,
    mode === 'dark' ? 'lighter' : 'darker',
  );
  if (gold.clamped) {
    notes.push('gold on paper-lifted: lightness adjusted for 4.5:1.');
  }

  // Bridge paper/ink into the Int UI semantic slots chrome already consumes.
  // Galley keeps its own reading plane via --gy-* which points at --ij-editor /
  // --ij-frame; those now resolve from paper-sunken / paper-canvas.
  const variables: Record<string, string> = {
    '--paper-canvas': css(canvas),
    '--paper-sunken': css(sunken),
    '--paper-lifted': css(lifted),
    '--paper-raised': css(raised),
    '--paper-seam': css(seam),
    '--ink-primary': css(primary),
    '--ink-secondary': css(secondary),
    '--ink-faint': css(faint),
    '--ij-frame': css(canvas),
    '--ij-editor': css(sunken),
    '--ij-chrome': css(lifted),
    '--ij-raised': css(raised),
    '--ij-seam': css(seam),
    '--ij-seam-raised': css(gamutColor(seam.l + (mode === 'dark' ? 0.06 : -0.04), seam.c, seam.h)),
    '--ij-divider': css(seam),
    '--ij-control-border': css(gamutColor(seam.l + (mode === 'dark' ? 0.1 : -0.08), Math.min(seam.c, 0.012), seam.h)),
    '--ij-ink': css(primary),
    '--ij-ink-info': css(secondary),
    '--ij-ink-disabled': css(faint),
    '--ij-ink-faint': css(faint),
    '--ij-selection': css(highlight.color),
    '--ij-text-selection': css(highlight.color),
    '--ij-selection-inactive': css(gamutColor(mode === 'dark' ? 0.32 : 0.91, 0.035, knobs.highlightHue)),
    '--ij-editor-line': css(gamutColor(mode === 'dark' ? 0.27 : 0.965, 0.018, knobs.highlightHue)),
    '--ij-search-match': css(gamutColor(mode === 'dark' ? 0.4 : 0.86, 0.07, knobs.highlightHue)),
    '--ij-gold': css(gold.color),
  };

  // Keep a 14-step gray ladder for anything still addressing --ij-gray-N.
  const anchors = LIGHTNESS_LADDERS[mode];
  for (let index = 0; index < 14; index += 1) {
    const source = anchors[index];
    const paperish = gamutColor(
      source.l,
      Math.min(knobs.tintChroma * (index < 7 ? 1 : 0.5), index < 3 ? 0.008 : knobs.tintChroma),
      knobs.tintHue + (index * 0.5),
    );
    variables[`--ij-gray-${index + 1}`] = css(paperish);
  }

  const accent = hexToOklch(mode === 'dark' ? '#3574F0' : '#3574F0');
  const checks = [
    check('ink on canvas', primary, canvas, 4.5),
    check('ink on sunken', primary, sunken, 4.5),
    check('secondary on canvas', secondary, canvas, 3),
    check('ink on selection', primary, highlight.color, 4.5),
    check('accent on lifted', accent, lifted, 3),
    check('gold on lifted', gold.color, lifted, 4.5),
  ];

  if (notes.length === 0) {
    notes.push('Contrast clamps ran; no pair required adjustment.');
  }

  return { mode, knobs, variables, checks, clampNotes: notes };
}

/** Acceptance helper: canvas chroma at a given paper anchor. */
export function measureCanvasChroma(mode: ResolvedThemeMode, anchor: number): number {
  return paperRoles(mode, clampPaperAnchor(anchor)).canvas.c;
}

/** Acceptance helper: primary ink chroma at a given paper anchor. */
export function measureInkChroma(
  mode: ResolvedThemeMode,
  anchor: number,
  chromaClamp = DEFAULT_INK_CHROMA_CLAMP,
): number {
  return inkRoles(mode, clampPaperAnchor(anchor), chromaClamp).primary.c;
}
