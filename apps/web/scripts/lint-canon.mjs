/**
 * C4 canon gate (HANDOFF-CANON).
 *
 * Fails when:
 *   1. an apps/web package.json dependency is absent from canon.json
 *   2. a package is claimed under more than one job
 *   3. a file imports a banned package and is not on the import allowlist
 *
 * Existing importers are grandfathered in packages/canon/import-allowlist.json
 * (generated from scan-canon). New files importing banned packages fail CI.
 * Self-test: `node scripts/lint-canon.mjs --self-test` plants a banned import
 * fixture and expects red.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "..", "..");
const canonPath = join(repoRoot, "packages", "canon", "canon.json");
const allowlistPath = join(repoRoot, "packages", "canon", "import-allowlist.json");
const packageJsonPath = join(webRoot, "package.json");
const scanRoots = [join(webRoot, "src"), join(webRoot, "scripts")];
const SKIP_FILES = new Set([
  join(webRoot, "scripts", "lint-canon.mjs"),
  join(webRoot, "scripts", "scan-canon.mjs"),
]);

/** @typedef {{ package: string, reason: string }} BannedEntry */
/** @typedef {{
 *   canonical?: string[],
 *   banned?: BannedEntry[],
 *   undecided?: string[],
 *   notes?: string
 * }} JobSpec */

/**
 * @param {unknown} raw
 * @returns {{ byPackage: Map<string, { job: string, status: 'canonical'|'banned'|'undecided', reason?: string }>, banned: Map<string, string>, jobs: string[] }}
 */
export function indexCanon(raw) {
  if (!raw || typeof raw !== "object" || !("jobs" in raw) || !raw.jobs || typeof raw.jobs !== "object") {
    throw new Error("canon.json missing jobs object");
  }
  /** @type {Map<string, { job: string, status: 'canonical'|'banned'|'undecided', reason?: string }>} */
  const byPackage = new Map();
  /** @type {Map<string, string>} */
  const banned = new Map();
  const jobs = Object.keys(/** @type {Record<string, JobSpec>} */ (raw.jobs));

  for (const [job, spec] of Object.entries(/** @type {Record<string, JobSpec>} */ (raw.jobs))) {
    for (const name of spec.canonical ?? []) {
      claim(byPackage, name, job, "canonical");
    }
    for (const entry of spec.banned ?? []) {
      const name = typeof entry === "string" ? entry : entry.package;
      const reason = typeof entry === "string" ? "banned" : entry.reason;
      claim(byPackage, name, job, "banned", reason);
      banned.set(name, reason);
    }
    for (const name of spec.undecided ?? []) {
      claim(byPackage, name, job, "undecided");
    }
  }
  return { byPackage, banned, jobs };
}

/**
 * @param {Map<string, { job: string, status: string, reason?: string }>} byPackage
 * @param {string} name
 * @param {string} job
 * @param {'canonical'|'banned'|'undecided'} status
 * @param {string} [reason]
 */
function claim(byPackage, name, job, status, reason) {
  if (!name || typeof name !== "string") {
    throw new Error(`invalid package name under job ${job}`);
  }
  const prior = byPackage.get(name);
  if (prior) {
    throw new Error(
      `package ${name} claimed by both ${prior.job} (${prior.status}) and ${job} (${status})`,
    );
  }
  byPackage.set(name, { job, status, reason });
}

/** Match bare and scoped package names from import/require/from strings. */
const IMPORT_RE =
  /(?:from\s+|import\s*\(|require\s*\()\s*['"]((?:@[^'"/]+\/[^'"/]+)|(?:[^'"./][^'"]*))['"]/g;

/**
 * Resolve an import path to a package root name for canon lookup.
 * @param {string} specifier
 */
export function packageRootFromSpecifier(specifier) {
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) {
    return null;
  }
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split("/")[0] ?? null;
}

/**
 * @param {string} allowlistFile
 * @returns {Map<string, Set<string>>} package -> set of relative paths
 */
export function loadAllowlist(allowlistFile) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  if (!existsSync(allowlistFile)) return map;
  const raw = JSON.parse(readFileSync(allowlistFile, "utf8"));
  const entries = raw?.packages ?? raw ?? {};
  for (const [pkg, files] of Object.entries(entries)) {
    map.set(pkg, new Set(Array.isArray(files) ? files : []));
  }
  return map;
}

/**
 * @param {string} file
 * @param {string} source
 * @param {Map<string, string>} banned
 * @param {Map<string, Set<string>>} allowlist
 * @returns {string[]}
 */
export function findBannedImports(file, source, banned, allowlist = new Map()) {
  const hits = [];
  const rel = relative(webRoot, file).replaceAll("\\", "/");
  for (const match of source.matchAll(IMPORT_RE)) {
    const root = packageRootFromSpecifier(match[1]);
    if (!root) continue;
    const reason = banned.get(root);
    if (!reason) continue;
    const allowed = allowlist.get(root);
    if (allowed && allowed.has(rel)) continue;
    hits.push(`${rel}: imports banned package ${root} (${reason})`);
  }
  return hits;
}

/**
 * @param {string[]} roots
 * @returns {string[]}
 */
function listSourceFiles(roots) {
  const out = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const listing = execFileSync(
      "rg",
      [
        "--files",
        "-g",
        "*.ts",
        "-g",
        "*.tsx",
        "-g",
        "*.js",
        "-g",
        "*.jsx",
        "-g",
        "*.mjs",
        "-g",
        "*.cjs",
        root,
      ],
      { encoding: "utf8", cwd: webRoot },
    );
    for (const line of listing.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (SKIP_FILES.has(trimmed)) continue;
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * @returns {{ failures: string[], okMessage: string }}
 */
export function runCanonLint({
  canonFile = canonPath,
  packageFile = packageJsonPath,
  allowlistFile = allowlistPath,
  roots = scanRoots,
  listFiles = listSourceFiles,
} = {}) {
  /** @type {string[]} */
  const failures = [];
  const canon = JSON.parse(readFileSync(canonFile, "utf8"));
  let index;
  try {
    index = indexCanon(canon);
  } catch (err) {
    return { failures: [String(err instanceof Error ? err.message : err)], okMessage: "" };
  }

  const allowlist = loadAllowlist(allowlistFile);
  const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
  for (const name of Object.keys(deps).sort()) {
    if (!index.byPackage.has(name)) {
      failures.push(
        `package.json dependency ${name} is absent from canon.json (classify as canonical, banned, or undecided under a job)`,
      );
    }
  }

  for (const file of listFiles(roots)) {
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      failures.push(`cannot read ${file}`);
      continue;
    }
    failures.push(...findBannedImports(file, source, index.banned, allowlist));
  }

  const okMessage = `canon lint clean (${index.byPackage.size} classified packages, ${index.banned.size} banned, ${allowlist.size} allowlisted packages, ${index.jobs.length} jobs).`;
  return { failures, okMessage };
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), "lint-canon-"));
  try {
    const fixture = join(dir, "banned-import.ts");
    // Build the banned import without embedding a matchable import in THIS file.
    const bannedPkg = ["sig", "ma"].join("");
    writeFileSync(fixture, `import Graph from '${bannedPkg}';\nexport const g = Graph;\n`, "utf8");
    const { failures } = runCanonLint({
      roots: [dir],
      listFiles: () => [fixture],
      allowlistFile: join(dir, "empty-allowlist.json"),
    });
    const hit = failures.some((f) => f.includes("banned package sigma"));
    if (!hit) {
      console.error("self-test failed: expected banned sigma import to fail");
      console.error(failures);
      process.exit(1);
    }
    console.log("canon lint self-test passed (banned import fixture is red).");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    selfTest();
  } else {
    const { failures, okMessage } = runCanonLint();
    if (failures.length > 0) {
      for (const f of failures) console.error(`✗ ${f}`);
      console.error(`\ncanon lint failed: ${failures.length} violation(s).`);
      process.exit(1);
    }
    console.log(okMessage);
  }
}
