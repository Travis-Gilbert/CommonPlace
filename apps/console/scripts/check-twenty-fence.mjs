#!/usr/bin/env node
// SOURCING: none. Pure logic, no upstream component applies. Modelled on
// scripts/check-import-fence.mjs, which makes the apps/web boundary structural.
//
// The AGPL bright line, mechanical (SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0 named
// choice 6, anti-scope 1). Twenty's monorepo is AGPLv3 except for four MIT
// packages. Only one of them is vendored here. This gate fails CI when:
//
//   1. Any import resolves into a Twenty path other than `twenty-ui`.
//   2. Any file in packages/twenty-ui carries the `@license Enterprise` marker.
//   3. The fork's MODIFICATIONS.md deletion list does not match reality: a path
//      it says was deleted still exists, or a console file still imports one.
//
// Point 3 is TU5's acceptance criterion, enforced instead of asserted.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const consoleSrc = path.join(appRoot, 'src');
const forkRoot = path.join(repoRoot, 'packages', 'twenty-ui');

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Twenty packages that are AGPL or otherwise off limits to this repository. */
const FORBIDDEN_TWENTY_SPECIFIERS = [
  'twenty-front',
  'twenty-server',
  'twenty-emails',
  'twenty-website',
  'twenty-zapier',
  'twenty-utils',
  'twenty-e2e-testing',
  '@twenty/front',
  '@twenty/server',
];

/** The one MIT package that may be imported, plus its subpaths. */
const ALLOWED_TWENTY_SPECIFIER = 'twenty-ui';

function* walk(dir, extensions) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full, extensions);
    else if (extensions.test(entry)) yield full;
  }
}

const findings = [];

// 1. Import audit across the console and every workspace package that is not
//    the fork itself.
const importRoots = [consoleSrc, path.join(repoRoot, 'packages')];
for (const root of importRoots) {
  for (const file of walk(root, /\.(ts|tsx|mts|cts|js|jsx|mjs|css|scss)$/)) {
    if (file.startsWith(forkRoot)) continue;
    const text = readFileSync(file, 'utf8');
    const specifiers = [];
    IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = IMPORT_RE.exec(text)) !== null) {
      specifiers.push(match[1] ?? match[2] ?? match[3]);
    }
    for (const cssImport of text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      specifiers.push(cssImport[1]);
    }
    for (const spec of specifiers) {
      if (!spec) continue;
      const forbidden = FORBIDDEN_TWENTY_SPECIFIERS.find(
        (name) => spec === name || spec.startsWith(`${name}/`),
      );
      if (forbidden !== undefined) {
        findings.push({
          file,
          detail: `imports '${spec}': ${forbidden} is AGPL and never crosses into this repository`,
        });
        continue;
      }
      // Anything else naming twenty must resolve to the vendored fork.
      if (
        /(^|\/)twenty[-/]/.test(spec) &&
        spec !== ALLOWED_TWENTY_SPECIFIER &&
        !spec.startsWith(`${ALLOWED_TWENTY_SPECIFIER}/`)
      ) {
        findings.push({
          file,
          detail: `imports '${spec}': only '${ALLOWED_TWENTY_SPECIFIER}' may resolve into the Twenty universe`,
        });
      }
    }
  }
}

// 2. Enterprise-marked source must not exist inside the fork.
for (const file of walk(forkRoot, /\.(ts|tsx|js|jsx|mjs|scss|css)$/)) {
  const text = readFileSync(file, 'utf8');
  if (text.includes('@license Enterprise')) {
    findings.push({
      file,
      detail: 'carries the @license Enterprise marker and is not MIT',
    });
  }
}

// 3. MODIFICATIONS.md deletion list matches reality.
const modificationsPath = path.join(forkRoot, 'MODIFICATIONS.md');
if (!existsSync(modificationsPath)) {
  findings.push({
    file: modificationsPath,
    detail: 'missing: the fork must record its modifications',
  });
} else {
  const modifications = readFileSync(modificationsPath, 'utf8');
  // Only the first table under the TU5 heading is the deletion list. The
  // section continues with a re-seated-in-place table, whose paths must still
  // exist, so the parse stops at the next prose heading.
  const section = modifications
    .split('## TU5. Console components deleted by the re-seat')[1]
    ?.split('\nRe-seated in place')[0];
  if (section === undefined) {
    findings.push({
      file: modificationsPath,
      detail: 'missing the TU5 deletion list section',
    });
  } else {
    const deleted = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map(
      (row) => row[1],
    );
    if (deleted.length === 0) {
      findings.push({
        file: modificationsPath,
        detail: 'TU5 deletion list is empty; the re-seat deletes what it replaces',
      });
    }
    for (const relative of deleted) {
      const absolute = path.join(repoRoot, relative);
      if (existsSync(absolute)) {
        findings.push({
          file: absolute,
          detail: `MODIFICATIONS.md lists this as deleted but it still exists`,
        });
      }
      // No console import may resolve to a deleted path.
      const stem = relative
        .replace(/^apps\/console\/src\//, '')
        .replace(/\.(tsx?|jsx?)$/, '');
      const needle = `/${path.basename(stem)}'`;
      for (const file of walk(consoleSrc, /\.(ts|tsx)$/)) {
        const text = readFileSync(file, 'utf8');
        if (
          text.includes(`@/${stem}'`) ||
          (text.includes(needle) && text.includes(path.dirname(stem)))
        ) {
          findings.push({
            file,
            detail: `imports the deleted path ${relative}`,
          });
        }
      }
    }
  }
}

if (findings.length > 0) {
  process.stderr.write('Twenty fence violations:\n');
  for (const finding of findings) {
    process.stderr.write(
      `  ${path.relative(repoRoot, finding.file)}: ${finding.detail}\n`,
    );
  }
  process.exit(1);
}

process.stdout.write(
  'Twenty fence: only twenty-ui resolves, no Enterprise-marked source, deletion list matches.\n',
);
