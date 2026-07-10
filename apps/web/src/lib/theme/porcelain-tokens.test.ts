// TW1: the register stays restrained (palette ceiling) and the measured DTCG
// sheet is well-formed.

import { describe, it, expect } from 'vitest';
import { tokenMap, toDTCG } from './porcelain-solver';

const HEX = /^#[0-9A-Fa-f]{3,8}$/;

function leaf(doc: Record<string, unknown>, path: string[]): { $value: string; $type: string } {
  let node: unknown = doc;
  for (const key of path) node = (node as Record<string, unknown>)[key];
  return node as { $value: string; $type: string };
}

describe('porcelain palette is restrained (TW1)', () => {
  const map = tokenMap('porcelain');

  it('distinct hex colors stay under the ceiling', () => {
    const hexes = new Set(Object.values(map).filter((value) => HEX.test(value)));
    // Twenty's look uses a restrained palette; this guards against bloat.
    expect(hexes.size).toBeLessThanOrEqual(40);
  });

  it('has exactly the ten tag families', () => {
    const tags = Object.keys(map).filter((key) => /^--tag-[a-z]+$/.test(key));
    expect(tags).toHaveLength(10);
  });
});

describe('DTCG sheet (TW1)', () => {
  const doc = toDTCG();

  it('carries the measured spacing, type, icon, radii, table, and color groups', () => {
    expect(leaf(doc, ['space', '2']).$value).toBe('8px');
    expect(leaf(doc, ['icon', 'md']).$value).toBe('16px');
    expect(leaf(doc, ['icon', 'lg']).$value).toBe('20px');
    expect(leaf(doc, ['radius', 'control']).$value).toBe('8px');
    expect(leaf(doc, ['text', 'md']).$value).toBe('1rem');
    expect(leaf(doc, ['table', 'checkbox-col']).$value).toBe('32px');
    expect(leaf(doc, ['color', 'porcelain', 'ink']).$value).toBe('#1A1A1A');
  });

  it('every leaf token declares $value and $type', () => {
    const walk = (node: Record<string, unknown>): void => {
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          if ('$value' in obj) expect(obj).toHaveProperty('$type');
          else walk(obj);
        }
      }
    };
    walk(doc);
  });
});
