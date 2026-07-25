/**
 * `apps/web/CLAUDE.md` forbids mock data in any file the production bundle
 * ships, and forbids a mock-mode flag by name. Two things enforce that here:
 *
 * 1. nothing outside a test file imports the fixture module
 * 2. no source file mentions the retired fixture flag
 *
 * This is a scan rather than a convention, because a convention is what the
 * flag was.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../../..');
const FIXTURE_MODULE = path.join(SRC, 'lib', 'search-stack', 'fixtures.ts');

const IS_TEST = /\.(test|spec)\.(ts|tsx)$/;
const SOURCE_EXT = new Set(['.ts', '.tsx']);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (SOURCE_EXT.has(path.extname(full))) yield full;
  }
}

/** Every import specifier in a file, from static imports and dynamic ones. */
function importSpecifiers(text: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bvi\.mock\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function resolvesToFixtures(specifier: string, fromFile: string): boolean {
  const target = specifier.startsWith('@/')
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (!target) return false;
  const normalized = target.endsWith('.ts') ? target : `${target}.ts`;
  return normalized === FIXTURE_MODULE;
}

describe('fixture containment', () => {
  it('is imported only by test files', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (IS_TEST.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (importSpecifiers(text).some((spec) => resolvesToFixtures(spec, file))) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is imported by at least one test file, so the scan is not vacuous', () => {
    const importers: string[] = [];
    for (const file of walk(SRC)) {
      if (!IS_TEST.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (importSpecifiers(text).some((spec) => resolvesToFixtures(spec, file))) {
        importers.push(path.relative(SRC, file));
      }
    }
    expect(importers.length).toBeGreaterThan(0);
  });

  it('leaves no trace of the retired fixture flag anywhere in src', () => {
    // Assembled rather than written out, so this file cannot flag itself.
    const flag = ['NEXT_PUBLIC', 'SEARCH', 'STACK', 'FIXTURES'].join('_');
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      if (text.includes(flag) || /\busingFixtures\b/.test(text)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the client free of any fixture import', () => {
    const file = path.join(SRC, 'lib', 'search-stack', 'client.ts');
    const specifiers = importSpecifiers(readFileSync(file, 'utf8'));
    expect(specifiers.some((spec) => resolvesToFixtures(spec, file))).toBe(false);
  });
});
