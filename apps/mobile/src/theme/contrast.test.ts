import { describe, expect, it } from 'vitest';

import { darkColors, lightColors, speaker } from './tokens';

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('mobile speaker register contrast', () => {
  it.each([
    ['human light', speaker.light.human, lightColors.surface],
    ['agent light', speaker.light.agent, lightColors.surface],
    ['memory light', speaker.light.memory, lightColors.bg],
    ['human dark', speaker.dark.human, darkColors.surface],
    ['agent dark', speaker.dark.agent, darkColors.surface],
    ['memory dark', speaker.dark.memory, darkColors.surface],
  ])('%s meets AA on its content surface', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
