#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
// Gate 6 (HANDOFF-CONSOLE-DIMENSIONALITY X2, named choice 2): components may
// not mint register tokens.
//
// Two failures, because there are two ways to import somebody else's design
// language. A component can DEFINE --ij-anything itself, which the register
// lint waves through because the value is a var(); or a token can be added to a
// register file without the manifest diff that reviews it. Both land here.

import { buildManifest, readManifest, mintedOutsideRegisters, REGISTER_PROVENANCE } from './token-manifest-lib.mjs';

const failures = [];

// 1. Minting outside the registers.
for (const offender of mintedOutsideRegisters()) {
  failures.push(
    `  ${offender.file}:${offender.line} mints ${offender.token} outside a register file (add it to a register with a provenance line, or consume an existing token)`,
  );
}

// 2. Manifest equality. The emitted token set must equal the checked-in file.
const emitted = buildManifest();
let checkedIn;
try {
  checkedIn = readManifest().tokens ?? {};
} catch {
  failures.push('  src/styles/token-manifest.json is missing or unreadable (run: npm run tokens:manifest)');
  checkedIn = {};
}

const emittedNames = new Set(Object.keys(emitted));
const checkedInNames = new Set(Object.keys(checkedIn));

for (const token of emittedNames) {
  if (!checkedInNames.has(token)) {
    failures.push(`  ${token} is defined in ${emitted[token].file} but absent from the manifest (run: npm run tokens:manifest)`);
  }
}
for (const token of checkedInNames) {
  if (!emittedNames.has(token)) {
    failures.push(`  ${token} is in the manifest but no register defines it (run: npm run tokens:manifest)`);
  }
}
for (const token of emittedNames) {
  const left = emitted[token];
  const right = checkedIn[token];
  if (!right) continue;
  if (left.file !== right.file) {
    failures.push(`  ${token} moved registers: manifest says ${right.file}, tree says ${left.file}`);
  }
  if (left.provenance !== right.provenance) {
    failures.push(`  ${token} provenance drifted from the manifest (run: npm run tokens:manifest)`);
  }
}

// 3. Every token carries a provenance line. This is the audit that catches any
//    other laundered family: a token whose owning file cannot say where its
//    values come from does not belong to the system.
for (const [token, entry] of Object.entries(emitted)) {
  if (!entry.provenance || !REGISTER_PROVENANCE[entry.file]) {
    failures.push(`  ${token} has no provenance line (owning file ${entry.file} is not a declared register)`);
  }
}

if (failures.length > 0) {
  console.error('Token manifest gate violations:');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(
  `Token manifest gate: clean (${emittedNames.size} tokens across ${Object.keys(REGISTER_PROVENANCE).length} registers, every one with a provenance line).`,
);
