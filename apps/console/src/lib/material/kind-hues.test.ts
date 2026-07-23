// SOURCING: none. Kind hue generator tests for SPEC-MATERIAL-REGISTER-1.0 D4.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  KIND_GLYPH_ORDER,
  KIND_HUE_CHROMA,
  KIND_HUE_LIGHTNESS,
  kindHueCss,
  kindHueDegrees,
} from './kind-hues';

const registerBridge = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/register-bridge.css'),
  'utf8',
);

describe('kindHues', () => {
  it('resolves every enum member to a register var present in the register', () => {
    for (const kind of KIND_GLYPH_ORDER) {
      expect(kindHueCss(kind)).toBe(`var(--ij-kind-${kind})`);
      expect(registerBridge).toContain(`--ij-kind-${kind}:`);
    }
  });

  it('uses a fixed lightness and chroma ramp in the register', () => {
    for (const kind of KIND_GLYPH_ORDER) {
      const hue = kindHueDegrees(kind).toFixed(0);
      // Register stores integer degrees for the 15-step ramp.
      expect(registerBridge).toMatch(
        new RegExp(`--ij-kind-${kind}:\\s*oklch\\(${KIND_HUE_LIGHTNESS * 100}% ${KIND_HUE_CHROMA} ${hue}\\)`),
      );
    }
  });

  it('assigns distinct hues', () => {
    const hues = KIND_GLYPH_ORDER.map((kind) => kindHueDegrees(kind));
    expect(new Set(hues).size).toBe(hues.length);
  });
});
