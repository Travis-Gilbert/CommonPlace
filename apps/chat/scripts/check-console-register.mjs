#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// Fails when src/styles/console-register.css drifts from the console's
// registers, i.e. when a token moved in the console and the fork was not
// regenerated. This is the mechanical half of named choice 5: one token truth
// cannot be enforced by intent, only by a gate.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_PATH,
  chatRoot,
  readConsoleRegisters,
  renderConsoleRegister,
} from './console-register-lib.mjs';

const relative = path.relative(chatRoot, OUTPUT_PATH);
const expected = renderConsoleRegister(readConsoleRegisters());

let actual;
try {
  actual = readFileSync(OUTPUT_PATH, 'utf8');
} catch {
  console.error(`Console register: ${relative} is missing. Run \`pnpm tokens\`.`);
  process.exit(1);
}

if (actual === expected) {
  console.log(`Console register: ${relative} matches the console registers.`);
  process.exit(0);
}

const expectedLines = expected.split('\n');
const actualLines = actual.split('\n');
const firstDifference = expectedLines.findIndex((line, index) => actualLines[index] !== line);

console.error(`Console register: ${relative} has drifted from the console registers.`);
console.error(`  first difference at line ${firstDifference + 1}`);
console.error(`  expected: ${expectedLines[firstDifference] ?? '(end of file)'}`);
console.error(`  actual:   ${actualLines[firstDifference] ?? '(end of file)'}`);
console.error('Run `pnpm tokens` and commit the result.');
process.exit(1);
