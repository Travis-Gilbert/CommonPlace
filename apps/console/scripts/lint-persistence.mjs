import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = path.join(APP_ROOT, 'src');
const FIXTURE_ROOT = path.join(SCRIPT_DIR, 'fixtures', 'persistence-lint');
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const STORAGE_OPERATION = /(?:window\.)?(?:localStorage|sessionStorage)\s*\./;
const STORAGE_CALL = new RegExp(STORAGE_OPERATION.source, 'g');
const PREFERENCE_COMMENT =
  /^\s*\/\/\s*persistence-preference:\s*key=([^;]+);\s*preference=([^;]+);\s*reason=(\S.*)$/;
const CACHE_COMMENT = /^\s*\/\/\s*persistence-cache:\s*reason=(\S.*)$/;

function nearbyComment(lines, lineIndex, pattern) {
  for (let index = lineIndex - 1; index >= Math.max(0, lineIndex - 2); index -= 1) {
    const line = lines[index] ?? '';
    if (!line.trim() || STORAGE_OPERATION.test(line)) break;
    const match = line.match(pattern);
    if (match) return match;
  }
  return null;
}

function preferenceComment(lines, lineIndex) {
  const match = nearbyComment(lines, lineIndex, PREFERENCE_COMMENT);
  if (!match) return null;
  const key = match[1].trim();
  const preference = match[2].trim();
  const reason = match[3].trim();
  if (key && preference && reason) return { key, preference, reason };
  return null;
}

function cacheComment(lines, lineIndex) {
  const match = nearbyComment(lines, lineIndex, CACHE_COMMENT);
  return match?.[1]?.trim() || null;
}

function inspectSource(filePath, source) {
  if (!SOURCE_EXTENSION.test(filePath)) {
    return { violations: [], preferences: [], caches: [] };
  }
  const lines = source.split(/\r?\n/);
  const violations = [];
  const preferences = [];
  const caches = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(STORAGE_CALL)) {
      const preference = preferenceComment(lines, lineIndex);
      if (preference) {
        preferences.push(preference);
        continue;
      }
      const cache = cacheComment(lines, lineIndex);
      if (cache) {
        caches.push(cache);
        continue;
      }
      violations.push({
        filePath,
        line: lineIndex + 1,
        column: (match.index ?? 0) + 1,
      });
    }
  }
  return { violations, preferences, caches };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filePath);
    return SOURCE_EXTENSION.test(filePath) ? [filePath] : [];
  }));
  return nested.flat();
}

async function runPlantedFixtureTest() {
  const bad = await readFile(path.join(FIXTURE_ROOT, 'planted-store.ts.fixture'), 'utf8');
  const preference = await readFile(
    path.join(FIXTURE_ROOT, 'preference-store.ts.fixture'),
    'utf8',
  );
  const cache = await readFile(path.join(FIXTURE_ROOT, 'layout-cache.ts.fixture'), 'utf8');
  const planted = inspectSource(path.join(SOURCE_ROOT, 'ordinary-view.ts'), bad);
  const allowed = inspectSource(path.join(SOURCE_ROOT, 'preference-store.ts'), preference);
  const hydrationCache = inspectSource(path.join(SOURCE_ROOT, 'ordinary-cache.ts'), cache);
  if (
    planted.violations.length !== 1
    || allowed.violations.length !== 0
    || allowed.preferences.length !== 1
    || hydrationCache.violations.length !== 1
    || hydrationCache.caches.length !== 1
  ) {
    throw new Error('persistence lint planted fixture did not exercise reject, preference, cache, and annotation-boundary lanes');
  }
}

async function main() {
  await runPlantedFixtureTest();
  if (process.argv.includes('--self-test')) {
    console.log('persistence lint planted fixture: PASS (4 cases)');
    return;
  }
  const files = await sourceFiles(SOURCE_ROOT);
  const reports = await Promise.all(files.map(async (filePath) => (
    inspectSource(filePath, await readFile(filePath, 'utf8'))
  )));
  const violations = reports.flatMap((report) => report.violations);
  const preferences = reports.flatMap((report) => report.preferences);
  const caches = reports.flatMap((report) => report.caches);
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${path.relative(APP_ROOT, violation.filePath)}:${violation.line}:${violation.column} browser storage is not a persistence tier`,
      );
    }
    process.exitCode = 1;
    return;
  }
  const allowlist = new Map(preferences.map((entry) => [entry.key, entry]));
  console.log(
    `persistence lint: PASS (${files.length} files, ${allowlist.size} preference key, ${caches.length} cache calls, 4 planted cases)`,
  );
}

await main();
