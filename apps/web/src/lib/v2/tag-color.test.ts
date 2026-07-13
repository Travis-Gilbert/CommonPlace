import { describe, it, expect } from 'vitest';
import { CR_TAG_CHIP, CR_TAG_HUES, tagChipClass, tagHue } from './tag-color';

describe('tag-color', () => {
  it('is deterministic: the same tag always resolves to the same hue', () => {
    expect(tagHue('design')).toBe(tagHue('design'));
    expect(tagHue('research')).toBe(tagHue('research'));
    // Stable across the module boundary (chip class follows the hue).
    expect(tagChipClass('design')).toBe(CR_TAG_CHIP[tagHue('design')]);
  });

  it('always returns a hue in the register scale', () => {
    for (const tag of ['', 'a', 'design', 'a very long tag name with spaces', '日本語', '123']) {
      expect(CR_TAG_HUES).toContain(tagHue(tag));
    }
  });

  it('spreads tags across more than one hue (not a constant)', () => {
    const sample = ['design', 'api', 'urgent', 'research', 'pkm', 'adhd', 'ops', 'ml', 'porch', 'teal'];
    const distinct = new Set(sample.map(tagHue));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('exposes a full soft/ink/line class trio for every hue', () => {
    for (const hue of CR_TAG_HUES) {
      const cls = CR_TAG_CHIP[hue];
      expect(cls).toContain(`bg-cr-tag-${hue}-soft`);
      expect(cls).toContain(`text-cr-tag-${hue}`);
      expect(cls).toContain(`border-cr-tag-${hue}-line`);
    }
  });

  it('covers exactly the ten register tag hues', () => {
    expect(CR_TAG_HUES).toHaveLength(10);
    expect(Object.keys(CR_TAG_CHIP).sort()).toEqual([...CR_TAG_HUES].sort());
  });
});
