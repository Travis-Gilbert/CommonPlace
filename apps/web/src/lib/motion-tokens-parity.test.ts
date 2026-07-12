import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// MT-1 acceptance (HANDOFF-MOTION-TOKENS): the motion scale is defined once and
// carried identically by three targets. This comparison test proves the web CSS
// custom properties and the mobile `motion` export hold the same values, so no
// target can drift. (The Reanimated presets in apps/mobile/src/theme/springs.ts
// derive their beziers from the same control points.)

const here = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(here, '../styles/commonplace-tokens.css');
const mobilePath = path.resolve(here, '../../../mobile/src/theme/tokens.ts');

const css = readFileSync(cssPath, 'utf8');
const ts = readFileSync(mobilePath, 'utf8');

const cssNum = (name: string): number =>
  Number(css.match(new RegExp(`--cp-${name}:\\s*(-?[0-9.]+)`))![1]);
const cssBezier = (name: string): number[] =>
  css
    .match(new RegExp(`--cp-${name}:\\s*cubic-bezier\\(([^)]+)\\)`))![1]
    .split(',')
    .map((s) => Number(s.trim()));
const tsNum = (name: string): number =>
  Number(ts.match(new RegExp(`${name}:\\s*(-?[0-9.]+)`))![1]);
const tsArr = (name: string): number[] =>
  ts
    .match(new RegExp(`${name}:\\s*\\[([^\\]]+)\\]`))![1]
    .split(',')
    .map((s) => Number(s.trim()));

describe('motion token parity (web CSS vs mobile tokens.ts)', () => {
  it('durations match', () => {
    expect(cssNum('dur-press')).toBe(tsNum('durPress'));
    expect(cssNum('dur-hover')).toBe(tsNum('durHover'));
    expect(cssNum('dur-local')).toBe(tsNum('durLocal'));
    expect(cssNum('dur-panel')).toBe(tsNum('durPanel'));
    expect(cssNum('dur-max')).toBe(tsNum('durMax'));
  });

  it('easings match', () => {
    expect(cssBezier('ease-out')).toEqual(tsArr('easeOut'));
    expect(cssBezier('ease-in-out')).toEqual(tsArr('easeInOut'));
    expect(cssBezier('ease-exit')).toEqual(tsArr('easeExit'));
  });

  it('transform vocabulary matches', () => {
    expect(cssNum('hover-lift')).toBe(tsNum('hoverLift'));
    expect(cssNum('press-scale')).toBe(tsNum('pressScale'));
    expect(cssNum('enter-rise')).toBe(tsNum('enterRise'));
  });
});
