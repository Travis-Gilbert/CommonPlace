/**
 * Design-taste lint (DT gates), companion to lint-console-register.mjs.
 *
 * Enforces the objective, metric-based rules of the design-taste-frontend
 * spec plus the project writing rules over the console lane. Scope: the
 * (console) route group, its v2/island component directories, and
 * console-shell.css. Legacy porcelain surfaces are out of scope until they
 * migrate (the same growth discipline as the register lint).
 *
 * Gates:
 *   DT-EMOJI   no pictographic emoji in source. The console's typographic
 *              dingbat apparatus (check marks, circles, crosses) is deliberate
 *              vocabulary and is NOT banned; the gate targets the emoji blocks
 *              (U+1F000..U+1FAFF) and the emoji variation selector.
 *   DT-DASH    no em or en dashes anywhere: comments, strings, CSS.
 *   DT-VH      no h-screen; full-height sections use min-h-[100dvh] so iOS
 *              Safari toolbar collapse cannot jump the layout.
 *   DT-MOTION  CSS transitions must not animate layout properties (all, width,
 *              height, top, left, right, bottom, inset, margin, padding);
 *              animate transform and opacity. transition-all is the same gate
 *              in utility form.
 *
 * Escape hatch: a line containing `dt-allow` is skipped (justify it inline).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const srcRoot = join(webRoot, "src");

const SCOPE_DIRS = [
  join(srcRoot, "app", "(console)"),
  join(srcRoot, "components", "v2"),
  join(srcRoot, "components", "island"),
];
const SCOPE_FILES = [join(srcRoot, "styles", "console-shell.css")];
const EXTS = new Set([".tsx", ".ts", ".css"]);

const LAYOUT_PROPS = new Set([
  "all",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "top",
  "left",
  "right",
  "bottom",
  "inset",
]);
const LAYOUT_PREFIXES = ["margin", "padding", "inset-"];

function isLayoutProp(prop) {
  if (LAYOUT_PROPS.has(prop)) return true;
  return LAYOUT_PREFIXES.some((p) => prop === p || prop.startsWith(p));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      yield* walk(full);
    } else {
      const ext = full.slice(full.lastIndexOf("."));
      if (!EXTS.has(ext)) continue;
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
      yield full;
    }
  }
}

const files = [...SCOPE_DIRS.flatMap((d) => [...walk(d)]), ...SCOPE_FILES];

const EMOJI = /[\u{1F000}-\u{1FAFF}]|\u{FE0F}/u;
const DASH = /[–—]/;
const H_SCREEN = /(?<!min-)(?<!max-)\bh-screen\b/;
const TRANSITION_DECL = /transition(?:-property)?\s*:\s*([^;{}]+)/g;
const TRANSITION_ALL_UTIL = /\btransition-all\b/;

const violations = [];

for (const file of files) {
  const rel = relative(webRoot, file);
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  lines.forEach((line, i) => {
    if (line.includes("dt-allow")) return;
    const at = `${rel}:${i + 1}`;
    if (EMOJI.test(line)) {
      violations.push(`${at}  DT-EMOJI  pictographic emoji (use a typographic glyph or an SVG primitive)`);
    }
    if (DASH.test(line)) {
      violations.push(`${at}  DT-DASH  em or en dash (use colon, comma, period, semicolon, or parentheses)`);
    }
    if (H_SCREEN.test(line)) {
      violations.push(`${at}  DT-VH  h-screen (use min-h-[100dvh]; h-screen jumps on mobile browsers)`);
    }
    if (TRANSITION_ALL_UTIL.test(line)) {
      violations.push(`${at}  DT-MOTION  transition-all (transition transform/opacity/colors explicitly)`);
    }
    for (const m of line.matchAll(TRANSITION_DECL)) {
      for (const part of m[1].split(",")) {
        const prop = part.trim().split(/\s+/)[0];
        if (prop && isLayoutProp(prop)) {
          violations.push(`${at}  DT-MOTION  transition animates layout property "${prop}" (animate transform or opacity)`);
        }
      }
    }
  });
}

if (violations.length) {
  console.error(`design-taste lint: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log(`design-taste lint clean (${files.length} file(s) in the console lane).`);
