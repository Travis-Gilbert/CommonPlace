import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// WL-2 acceptance (HANDOFF-WAIT-LADDER D2): apps/mobile cannot import across the
// package boundary from apps/web, so apps/mobile/src/lib/waitNarration.ts is a
// documented mirror rather than a shared import (same pattern as the motion
// token mirror verified by motion-tokens-parity.test.ts). This test proves the
// two inventories hold the same operation kinds and the same step strings, so
// the mirror cannot silently drift.

const here = path.dirname(fileURLToPath(import.meta.url));
const webPath = path.resolve(here, './commonplace-wait-narration.ts');
const mobilePath = path.resolve(here, '../../../mobile/src/lib/waitNarration.ts');

const webSource = readFileSync(webPath, 'utf8');
const mobileSource = readFileSync(mobilePath, 'utf8');

function extractInventoryBlock(source: string): string {
  const match = source.match(
    /WAIT_NARRATION_INVENTORY:\s*WaitNarrationInventory\s*=\s*\{([\s\S]*?)\}\s*as const;/,
  );
  if (!match) throw new Error('WAIT_NARRATION_INVENTORY block not found');
  return match[1];
}

function parseInventory(block: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const entryRegex = /(\w+):\s*\[([^\]]*)\]/g;
  let entry: RegExpExecArray | null;
  while ((entry = entryRegex.exec(block))) {
    const [, kind, itemsRaw] = entry;
    const items = itemsRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.slice(1, -1));
    result[kind] = items;
  }
  return result;
}

const webInventory = parseInventory(extractInventoryBlock(webSource));
const mobileInventory = parseInventory(extractInventoryBlock(mobileSource));

describe('wait narration inventory parity (web vs mobile)', () => {
  it('has at least one operation kind (regex extraction actually found entries)', () => {
    expect(Object.keys(webInventory).length).toBeGreaterThan(0);
  });

  it('has the same operation kinds on both sides', () => {
    expect(Object.keys(mobileInventory).sort()).toEqual(Object.keys(webInventory).sort());
  });

  it('has identical ordered step strings for every operation kind', () => {
    for (const kind of Object.keys(webInventory)) {
      expect(mobileInventory[kind]).toEqual(webInventory[kind]);
    }
  });
});
