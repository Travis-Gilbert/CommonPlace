#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// Writes src/styles/console-register.css from the console's register files
// (SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3). Run after any console register
// change; the diff it produces is the review.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_PATH,
  chatRoot,
  readConsoleRegisters,
  renderConsoleRegister,
} from './console-register-lib.mjs';

const registers = readConsoleRegisters();
writeFileSync(OUTPUT_PATH, renderConsoleRegister(registers));
console.log(
  `Console register: wrote ${registers.light.size} light and ${registers.dark.size} dark tokens to ${path.relative(chatRoot, OUTPUT_PATH)}.`,
);
