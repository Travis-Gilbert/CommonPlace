#!/usr/bin/env node
// SOURCING: none. Pure logic.
// SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC2: typed sourcing gate.
// Fails when a ViewDescriptor omits sourcing, a non-bespoke mode omits
// upstream, bespoke omits a reason, or a src/views file contains a color
// literal (hex or raw color function).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(appRoot, 'src');
const viewsRoot = path.join(srcRoot, 'views');
const registryPath = path.join(viewsRoot, 'registry.tsx');

const MODES = new Set(['vendor', 'reskin', 'wrap', 'fork', 'bespoke']);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RAW_COLOR_FN_RE = /\b(?:oklch|oklab|rgba?|hsla?|hwb|lab|lch)\(|color-mix\(/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

const violations = [];

const registryText = readFileSync(registryPath, 'utf8');
const descriptorBlocks = [...registryText.matchAll(/const\s+[A-Z0-9_]+\s*:\s*ViewDescriptor\s*=\s*\{([\s\S]*?)\n\};/g)];

if (descriptorBlocks.length === 0) {
  violations.push({
    file: registryPath,
    line: 1,
    name: 'no ViewDescriptor const blocks found',
    sample: 'expected const NAME: ViewDescriptor = { ... };',
  });
}

for (const match of descriptorBlocks) {
  const body = match[1];
  const start = match.index ?? 0;
  const line = registryText.slice(0, start).split('\n').length;
  const idMatch = body.match(/\bid:\s*'([^']+)'/);
  const id = idMatch?.[1] ?? '(unknown)';

  if (!/\bsourcing\s*:/.test(body)) {
    violations.push({
      file: registryPath,
      line,
      name: 'missing sourcing',
      sample: id,
    });
    continue;
  }

  const sourcingMatch = body.match(/sourcing:\s*\{([\s\S]*?)\}/);
  if (!sourcingMatch) {
    violations.push({
      file: registryPath,
      line,
      name: 'unparseable sourcing',
      sample: id,
    });
    continue;
  }
  const sourcing = sourcingMatch[1];
  const modeMatch = sourcing.match(/mode:\s*'([^']+)'/);
  const mode = modeMatch?.[1];
  if (!mode || !MODES.has(mode)) {
    violations.push({
      file: registryPath,
      line,
      name: 'invalid or missing sourcing.mode',
      sample: id,
    });
    continue;
  }

  const upstreamMatch = sourcing.match(/upstream:\s*'([^']+)'/);
  const reasonMatch = sourcing.match(/allowedBespokeReason:\s*(?:'([^']*)'|\(([\s\S]*?)\))/);

  if (mode === 'bespoke') {
    const reason = (reasonMatch?.[1] ?? reasonMatch?.[2] ?? '').trim();
    if (!reason) {
      violations.push({
        file: registryPath,
        line,
        name: 'bespoke missing allowedBespokeReason',
        sample: id,
      });
    }
  } else if (!upstreamMatch?.[1]) {
    violations.push({
      file: registryPath,
      line,
      name: 'non-bespoke missing upstream',
      sample: `${id} mode=${mode}`,
    });
  }
}

if (statSync(viewsRoot).isDirectory()) {
  for (const file of walk(viewsRoot)) {
    if (file.endsWith(`${path.sep}registry.tsx`)) continue;
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((lineText, index) => {
      for (const [name, re] of [
        ['hex literal', HEX_RE],
        ['raw color function', RAW_COLOR_FN_RE],
      ]) {
        re.lastIndex = 0;
        const hit = re.exec(lineText);
        if (hit) {
          violations.push({
            file,
            line: index + 1,
            name,
            sample: hit[0],
          });
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('gate:sourcing failed:');
  for (const v of violations) {
    console.error(`  ${path.relative(appRoot, v.file)}:${v.line} ${v.name} (${v.sample})`);
  }
  process.exit(1);
}

console.log(
  `gate:sourcing ok (${descriptorBlocks.length} descriptors, views color scan clean)`,
);
