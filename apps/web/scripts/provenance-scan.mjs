// Provenance gate for the clean-room recreation.
//
// Purpose: prove that no file under apps/web/src derives from twentyhq/twenty.
// The scan flags two classes of provenance violation:
//   1. An import whose module specifier belongs to a twenty / twentyhq package
//      (for example: from 'twenty-ui', import '@twenty/foo', require('twentyhq/bar')).
//   2. A line that carries a copied-source marker string. Twenty's enterprise
//      files ship an "@license Enterprise" header, and any literal reference to
//      "twentyhq/twenty" inside source is treated as a copy smell.
//
// Usage: node scripts/provenance-scan.mjs
//   Exit 0 and a clean summary when the tree has no violation.
//   Exit 1 and a "file:line: reason" report for every hit when it does.
//
// This file is self-contained (no external dependencies) and exports scanPath()
// and the smaller helpers so scripts/provenance-scan.test.mjs can drive them.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const SRC_DIR = path.join(APP_DIR, 'src');

// Directories that must never be walked.
const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', 'out']);

// Text file extensions worth scanning. Anything else (images, fonts, binaries)
// cannot carry an import or a license header, so it is skipped.
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.sass', '.less',
  '.md', '.mdx', '.json', '.html', '.htm', '.svg', '.txt',
  '.yml', '.yaml', '.vue',
]);

// A module specifier belongs to a twenty package when it starts with "twenty"
// or "@twenty" (optionally "twentyhq" / "@twentyhq") followed by a path
// separator, a hyphen, or the end of the string. This matches "twenty",
// "twenty-ui", "twenty/foo", "@twenty/foo", "@twentyhq/foo", and "twentyhq/x"
// while leaving unrelated names such as "twentywise" untouched.
const TWENTY_SPEC = /^@?twenty(?:hq)?(?:[/-]|$)/i;

// Copied-source marker strings, matched case insensitively as a substring.
const MARKERS = ['twentyhq/twenty', '@license Enterprise'];

// Import shapes whose quoted argument is a module specifier.
const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,               // import ... from 'x'; export ... from 'x'; } from 'x'
  /\bimport\s*['"]([^'"]+)['"]/g,             // import 'x' (side effect)
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,   // import('x') (dynamic)
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,  // require('x')
];

// Return the distinct violation reasons found on a single line (empty when clean).
export function scanLine(line) {
  const reasons = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const specifier = match[1];
      if (TWENTY_SPEC.test(specifier)) {
        reasons.add(`import from twenty package "${specifier}"`);
      }
    }
  }

  const lowered = line.toLowerCase();
  for (const marker of MARKERS) {
    if (lowered.includes(marker.toLowerCase())) {
      reasons.add(`contains copied-source marker "${marker}"`);
    }
  }

  return [...reasons];
}

// Scan one absolute file path. Returns an array of { file, line, reason, text }.
export function scanFile(absPath) {
  let content;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    return [];
  }

  const violations = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const reasons = scanLine(lines[index]);
    if (reasons.length > 0) {
      violations.push({
        file: absPath,
        line: index + 1,
        reason: reasons.join('; '),
        text: lines[index].trim().slice(0, 200),
      });
    }
  }
  return violations;
}

// Collect every scannable text file under dir, skipping excluded and symlinked entries.
export function collectFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(full));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

// Recursively scan dir and return a flat array of violations.
export function scanPath(dir) {
  const violations = [];
  for (const file of collectFiles(dir)) {
    for (const violation of scanFile(file)) {
      violations.push(violation);
    }
  }
  return violations;
}

function relativeToApp(absPath) {
  const rel = path.relative(APP_DIR, absPath);
  return rel === '' ? absPath : rel;
}

function main() {
  const files = collectFiles(SRC_DIR);
  const violations = [];
  for (const file of files) {
    for (const violation of scanFile(file)) {
      violations.push(violation);
    }
  }

  for (const violation of violations) {
    process.stdout.write(`${relativeToApp(violation.file)}:${violation.line}: ${violation.reason}\n`);
  }

  if (violations.length > 0) {
    const offendingFiles = new Set(violations.map((v) => v.file)).size;
    process.stdout.write(
      `provenance-scan: FAIL. ${violations.length} violation(s) in ${offendingFiles} file(s) across ${files.length} files scanned under src/.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `provenance-scan: clean. 0 violations across ${files.length} files scanned under src/.\n`,
  );
  process.exit(0);
}

const invokedHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedHref) {
  main();
}
