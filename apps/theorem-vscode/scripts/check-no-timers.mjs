// SOURCING: none. Twenty lines of source scanning; a lint plugin for one rule
// would be more configuration than rule.
/**
 * V1 acceptance, mechanised: "a grep of the pack shows no interval timers".
 *
 * Polling is the failure this whole surface is built to avoid, and it is the
 * kind of thing that reappears in a hurry during a debugging session and then
 * stays. So the grep is a gate, not a habit.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const BANNED = /\bsetInterval\b|\bsetTimeout\b/;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const offenders = walk(SRC)
  .filter((path) => path.endsWith('.ts'))
  .flatMap((path) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line, index) => ({ path, line: index + 1, text: line }))
      .filter((entry) => BANNED.test(entry.text) && !entry.text.trimStart().startsWith('*')),
  );

if (offenders.length > 0) {
  for (const offender of offenders) {
    console.error(`${offender.path}:${offender.line}: ${offender.text.trim()}`);
  }
  console.error(`\nno-timers gate failed: ${offenders.length} timer call(s) in the pack.`);
  process.exit(1);
}

console.log('no-timers gate passed: the pack polls nothing.');
