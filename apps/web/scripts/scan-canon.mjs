/**
 * C2 evidence scan (HANDOFF-CANON).
 *
 * For every banned (and optionally undecided) package in packages/canon/canon.json,
 * list importing files under apps/web/src and apps/web/scripts, then emit a verdict:
 *   - unused: zero importers (deletable immediately)
 *   - used-in-legacy-surface: importers only under unread/legacy route groups
 *   - used-in-live-surface: any importer outside those groups
 *
 * Unread surfaces called out by the handoff:
 *   (studio), (networks), (spacetime), theseus
 *
 * Matching uses the same import/require regex as lint-canon (not substring),
 * so comments and type-name strings do not count as importers.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { packageRootFromSpecifier } from "./lint-canon.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "..", "..");
const canonPath = join(repoRoot, "packages", "canon", "canon.json");
const outDir = join(repoRoot, "docs", "plans", "handoff-canon");
const outPath = join(outDir, "canon-scan.json");

const LEGACY_MARKERS = [
  "/(studio)/",
  "/(networks)/",
  "/(spacetime)/",
  "/theseus/",
  "/components/theseus/",
  "/lib/theseus/",
  "/lib/theseus-viz/",
  "/app/studio/",
  "/app/networks/",
  "/app/spacetime/",
];

const IMPORT_RE =
  /(?:from\s+|import\s*\(|require\s*\()\s*['"]((?:@[^'"/]+\/[^'"/]+)|(?:[^'"./][^'"]*))['"]/g;

/**
 * @param {string} rel
 */
function isLegacySurface(rel) {
  const norm = rel.replaceAll("\\", "/");
  return LEGACY_MARKERS.some((m) => norm.includes(m));
}

/**
 * @param {string} packageName
 * @returns {string[]}
 */
function findImporters(packageName) {
  let candidates = [];
  try {
    const raw = execFileSync(
      "rg",
      ["-l", "--glob", "*.{ts,tsx,js,jsx,mjs,cjs}", "-F", packageName, "src", "scripts"],
      { encoding: "utf8", cwd: webRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    candidates = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (err) {
    if (err && typeof err === "object" && "status" in err && err.status === 1) return [];
    throw err;
  }

  const importers = [];
  for (const absOrRel of candidates) {
    const abs = absOrRel.startsWith("/") ? absOrRel : join(webRoot, absOrRel);
    const text = readFileSync(abs, "utf8");
    IMPORT_RE.lastIndex = 0;
    let match;
    let hits = false;
    while ((match = IMPORT_RE.exec(text))) {
      const root = packageRootFromSpecifier(match[1]);
      if (root === packageName) {
        hits = true;
        break;
      }
    }
    if (hits) importers.push(relative(webRoot, abs));
  }
  return importers;
}

/**
 * @param {string} packageName
 * @param {string[]} importers
 */
function verdictFor(packageName, importers) {
  if (importers.length === 0) return "unused";
  const live = importers.filter((p) => !isLegacySurface(p));
  if (live.length === 0) return "used-in-legacy-surface";
  return "used-in-live-surface";
}

function main() {
  const canon = JSON.parse(readFileSync(canonPath, "utf8"));
  /** @type {Array<{ package: string, job: string, status: string, reason?: string, importers: string[], verdict: string, migration?: string }>} */
  const rows = [];

  for (const [job, spec] of Object.entries(canon.jobs ?? {})) {
    for (const entry of spec.banned ?? []) {
      const name = typeof entry === "string" ? entry : entry.package;
      const reason = typeof entry === "string" ? undefined : entry.reason;
      const importers = findImporters(name);
      const verdict = verdictFor(name, importers);
      rows.push({
        package: name,
        job,
        status: "banned",
        reason,
        importers,
        verdict,
        migration:
          verdict === "unused"
            ? "deletable immediately"
            : `migrate ${importers.length} importer(s) before delete`,
      });
    }
    for (const name of spec.undecided ?? []) {
      const importers = findImporters(name);
      rows.push({
        package: name,
        job,
        status: "undecided",
        importers,
        verdict: verdictFor(name, importers),
      });
    }
  }

  rows.sort((a, b) => a.package.localeCompare(b.package));

  const summary = {
    unused: rows.filter((r) => r.verdict === "unused").length,
    legacy: rows.filter((r) => r.verdict === "used-in-legacy-surface").length,
    live: rows.filter((r) => r.verdict === "used-in-live-surface").length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    canonVersion: canon.version ?? 1,
    summary,
    packages: rows,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`canon scan wrote ${outPath}`);
  console.log(
    `verdicts: ${summary.unused} unused, ${summary.legacy} legacy-only, ${summary.live} live-surface`,
  );
  for (const row of rows.filter((r) => r.status === "banned")) {
    console.log(`  [${row.verdict}] ${row.package} (${row.importers.length} importers)`);
  }
}

main();
