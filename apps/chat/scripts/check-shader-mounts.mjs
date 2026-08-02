#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3: the shader mount count per window is
// one. Every @paper-design/shaders-react element is a ShaderMount with its own
// WebGL context, and a browser silently kills the oldest once a document holds
// more than about sixteen. Counting call sites is the only cheap check: a
// screenshot of a working surface looks identical either way, and the failure
// only shows up on the busiest session, which is the one nobody screenshots.
//
// The single permitted mount is PageBackground. Everything decorative uses the
// compositor orb (src/react-app/design-system/grain-orb.tsx).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const chatRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(chatRoot, 'src');

/** The one component allowed to mount a shader, and nothing else. */
const AMBIENT_MOUNT = 'src/components/page.tsx';

const SHADER_IMPORT = /from\s+["']@paper-design\/shaders-react["']/;

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry)) {
      yield full;
    }
  }
}

const offenders = [];
for (const file of sourceFiles(sourceRoot)) {
  const relative = path.relative(chatRoot, file);
  if (relative === AMBIENT_MOUNT) continue;
  if (SHADER_IMPORT.test(readFileSync(file, 'utf8'))) offenders.push(relative);
}

if (offenders.length === 0) {
  console.log(`Shader mounts: 1 (${AMBIENT_MOUNT}).`);
  process.exit(0);
}

console.error(`Shader mounts: ${offenders.length + 1}, expected 1.`);
for (const offender of offenders) console.error(`  ${offender} imports @paper-design/shaders-react`);
console.error(`Only ${AMBIENT_MOUNT} may mount a shader. Use GrainOrb for decorative motion.`);
process.exit(1);
