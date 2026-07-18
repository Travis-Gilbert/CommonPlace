// SOURCING: @travis-gilbert/markdown-theory/tokens oklchToSrgb. The register
// package already owns the OKLCH color math; this file only parses the CSS
// custom-property string and scales the package's 0..1 floats to canvas bytes.

/* Read a --cr-* custom property whose value is oklch(L% C H) and resolve it to
   a 0..255 sRGB tuple for canvas painting (HP3). The site's existing
   hexToRgb-style readers cannot parse oklch, and the console register is
   oklch-native (CR1), so canvas surfaces resolve their ink through this
   instead of hardcoding a color literal. */

import { oklchToSrgb } from '@travis-gilbert/markdown-theory/tokens';

/** Default when the token is missing or unparseable: a neutral ink-3 grey. */
const FALLBACK: [number, number, number] = [143, 137, 128];

export function readOklchVar(
  varName: string,
  fallback: [number, number, number] = FALLBACK,
): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return oklchCssToSrgb(raw) ?? fallback;
}

/** Parse `oklch(L% C H)` (L may also be a bare 0..1 number) to 0..255 sRGB. */
export function oklchCssToSrgb(css: string): [number, number, number] | null {
  const m = css.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  const l = m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const { r, g, b } = oklchToSrgb({ l, c: parseFloat(m[3]), h: parseFloat(m[4]) });
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [byte(r), byte(g), byte(b)];
}
