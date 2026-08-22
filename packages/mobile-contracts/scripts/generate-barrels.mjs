import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedRoot = join(packageRoot, 'src', 'generated', 'mobile-kernel-contract');
const checkOnly = process.argv.includes('--check');
const header = '// Generated from synchronized ts-rs bindings. Do not edit by hand.\n';

function typeNames(directory) {
  return readdirSync(directory)
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => entry.slice(0, -3))
    .sort();
}

function exportsFor(names, sourceDirectory = '') {
  return names
    .map(
      (name) =>
        `export type { ${name} } from './generated/mobile-kernel-contract/${sourceDirectory}${name}';`,
    )
    .join('\n');
}

const moduleBarrels = [
  ['object-schema.ts', 'object_schema'],
  ['run-event.ts', 'run_event'],
  ['remote-surface.ts', 'remote_surface'],
];
const outputs = new Map(
  moduleBarrels.map(([filename, sourceDirectory]) => [
    join(packageRoot, 'src', filename),
    `${header}${exportsFor(typeNames(join(generatedRoot, sourceDirectory)), `${sourceDirectory}/`)}\n`,
  ]),
);

outputs.set(
  join(packageRoot, 'src', 'index.ts'),
  `${header}${exportsFor(typeNames(generatedRoot))}\nexport * from './object-schema';\nexport * from './remote-surface';\nexport * from './run-event';\n`,
);

const drifted = [];
for (const [filename, expected] of outputs) {
  if (checkOnly) {
    if (readFileSync(filename, 'utf8') !== expected) drifted.push(filename);
  } else {
    writeFileSync(filename, expected);
  }
}

if (drifted.length > 0) {
  throw new Error(`Generated mobile-contract barrel drift: ${drifted.join(', ')}`);
}
