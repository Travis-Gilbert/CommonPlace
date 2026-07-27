import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE_ROOT = path.join(APP_ROOT, 'src');
const FIXTURE_ROOT = path.join(SCRIPT_DIR, 'fixtures', 'persistence-lint');
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const STORAGE_CALL = /(?:window\.)?(?:localStorage|sessionStorage)\s*\./g;
const PREFERENCE_COMMENT =
  /persistence-preference:\s*key=([^;]+);\s*preference=([^;]+);\s*reason=(\S.*)$/;

function isHydrationCache(filePath) {
  const stem = path.basename(filePath).replace(SOURCE_EXTENSION, '');
  return stem === 'cache' || stem.endsWith('-cache');
}

function isPersistenceModule(filePath) {
  if (!SOURCE_EXTENSION.test(filePath) || isHydrationCache(filePath)) return false;
  const relative = path.relative(SOURCE_ROOT, filePath);
  const segments = relative.split(path.sep);
  if (segments.some((segment) => ['persistence', 'store', 'stores', 'state'].includes(segment))) {
    return true;
  }
  const stem = path.basename(filePath).replace(SOURCE_EXTENSION, '');
  return /(?:^|[-.])(?:persistence|store|state)(?:$|[-.])/.test(stem);
}

function preferenceComment(lines, lineIndex) {
  for (let index = lineIndex; index >= Math.max(0, lineIndex - 2); index -= 1) {
    const match = lines[index]?.match(PREFERENCE_COMMENT);
    if (!match) continue;
    const key = match[1].trim();
    const preference = match[2].trim();
    const reason = match[3].trim();
    if (key && preference && reason) return { key, preference, reason };
  }
  return null;
}

function inspectSource(filePath, source) {
  if (!isPersistenceModule(filePath)) return { violations: [], preferences: [] };
  const lines = source.split(/\r?\n/);
  const violations = [];
  const preferences = [];
  for (const [lineIndex, line] of lines.entries()) {
    for (const match of line.matchAll(STORAGE_CALL)) {
      const preference = preferenceComment(lines, lineIndex);
      if (preference) {
        preferences.push(preference);
        continue;
      }
      violations.push({
        filePath,
        line: lineIndex + 1,
        column: (match.index ?? 0) + 1,
      });
    }
  }
  return { violations, preferences };
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
  const planted = inspectSource(path.join(SOURCE_ROOT, 'planted-store.ts'), bad);
  const allowed = inspectSource(path.join(SOURCE_ROOT, 'preference-store.ts'), preference);
  const hydrationCache = inspectSource(path.join(SOURCE_ROOT, 'state', 'layout-cache.ts'), cache);
  if (
    planted.violations.length !== 1
    || allowed.violations.length !== 0
    || allowed.preferences.length !== 1
    || hydrationCache.violations.length !== 0
  ) {
    throw new Error('persistence lint planted fixture did not exercise reject, preference, and cache lanes');
  }
}

async function main() {
  await runPlantedFixtureTest();
  if (process.argv.includes('--self-test')) {
    console.log('persistence lint planted fixture: PASS (3 cases)');
    return;
  }
  const files = await sourceFiles(SOURCE_ROOT);
  const reports = await Promise.all(files.map(async (filePath) => (
    inspectSource(filePath, await readFile(filePath, 'utf8'))
  )));
  const violations = reports.flatMap((report) => report.violations);
  const preferences = reports.flatMap((report) => report.preferences);
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
    `persistence lint: PASS (${files.length} files, ${allowlist.size} preference key, 3 planted cases)`,
  );
}

await main();
