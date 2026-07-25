// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.0 CS5: hue audit.
// Walks a block subtree, collects computed colors, and warns when more than
// one chromatic hue family appears outside the ladder.

export interface HueSample {
  readonly el: Element;
  readonly property: string;
  readonly value: string;
  readonly hue: number | null;
  readonly chroma: number;
}

export interface HueAuditResult {
  readonly samples: readonly HueSample[];
  readonly families: readonly number[];
  readonly ok: boolean;
  readonly warnings: readonly string[];
}

const LADDER_TOLERANCE_C = 0.02;
const FAMILY_BUCKET = 24;

function parseOklch(value: string): { l: number; c: number; h: number } | null {
  const match = value.match(/oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)/i);
  if (!match) return null;
  let l = Number(match[1]);
  if (l > 1) l /= 100;
  return { l, c: Number(match[2]), h: Number(match[3]) };
}

function parseRgb(value: string): { r: number; g: number; b: number } | null {
  const match = value.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (!match) return null;
  return { r: Number(match[1]) / 255, g: Number(match[2]) / 255, b: Number(match[3]) / 255 };
}

function rgbToOklch(r: number, g: number, b: number): { c: number; h: number } {
  const lin = [r, g, b].map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const [lr, lg, lb] = lin;
  const l3 = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m3 = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s3 = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const c = Math.sqrt(a * a + bb * bb);
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { c, h };
}

function sampleColor(value: string): { hue: number | null; chroma: number } {
  if (!value || value === 'transparent' || value === 'none') return { hue: null, chroma: 0 };
  const oklch = parseOklch(value);
  if (oklch) return { hue: oklch.c < LADDER_TOLERANCE_C ? null : oklch.h, chroma: oklch.c };
  const rgb = parseRgb(value);
  if (!rgb) return { hue: null, chroma: 0 };
  const converted = rgbToOklch(rgb.r, rgb.g, rgb.b);
  return { hue: converted.c < LADDER_TOLERANCE_C ? null : converted.h, chroma: converted.c };
}

const PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'] as const;

/**
 * Audit a block subtree. Identity chips (`[data-identity-chip]`) and explicit
 * status/accent markers are allowed one chromatic family; everything else in
 * chrome must stay within ladder tolerance.
 */
export function auditBlockHues(root: Element): HueAuditResult {
  const samples: HueSample[] = [];
  const nodes = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const el of nodes) {
    if (el.hasAttribute('data-identity-chip')) continue;
    if (el.closest('[data-status-hue], [data-accent-hue]')) continue;
    const style = getComputedStyle(el);
    for (const property of PROPS) {
      const value = style[property];
      const { hue, chroma } = sampleColor(value);
      if (chroma < LADDER_TOLERANCE_C) continue;
      samples.push({ el, property, value, hue, chroma });
    }
  }

  const families = Array.from(
    new Set(
      samples
        .map((sample) => sample.hue)
        .filter((hue): hue is number => hue !== null)
        .map((hue) => Math.round(hue / FAMILY_BUCKET) * FAMILY_BUCKET),
    ),
  ).sort((a, b) => a - b);

  const warnings: string[] = [];
  if (families.length > 1) {
    warnings.push(
      `Block carries ${families.length} chromatic hue families (${families.join(', ')}). Spec allows at most one, and only for state.`,
    );
  }

  return {
    samples,
    families,
    ok: families.length <= 1,
    warnings,
  };
}

export function runDevHueAudit(root: Element | null): void {
  if (process.env.NODE_ENV === 'production' || !root) return;
  const result = auditBlockHues(root);
  for (const warning of result.warnings) {
    console.warn('[hue-audit]', warning);
  }
}
