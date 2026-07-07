/**
 * CR1 literal lint + CR2 depth lint.
 *
 * The console register is the single source of every color, size, radius, and
 * shadow in migrated new-shell CSS. This lint fails any file in the migrated set
 * that hand-picks a value the register should own:
 *
 *   • hex or rgb/rgba color literals (CR1) — color comes from --cr-* only.
 *   • raw px on font-size or border-radius (CR1) — type and shape are tokens.
 *   • any box-shadow other than none or var(--cr-shadow-transient) (CR2) —
 *     static layout casts no shadow; the one sanctioned shadow is transient.
 *   • inset shadows (CR2) — the relief model is dead.
 *   • linear/radial-gradient (CR2) — surfaces are flat tonal steps.
 *
 * Layout px (widths, 1px hairlines, outline offsets) are allowed: the register
 * owns the visual language, not every geometric dimension. The migrated set
 * grows one entry per surface that moves off porcelain (CR5 onward); legacy
 * porcelain files are intentionally out of scope until they migrate.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const styles = (name) => join(here, "..", "src", "styles", name);

/** CSS files that have migrated onto the console register. Add one per surface. */
const MIGRATED = [styles("console-shell.css")];

const src = (rel) => join(here, "..", "src", rel);

/**
 * Components written in register-constrained Tailwind utilities. WORK-SURFACE
 * decision 1: the register emits into @theme so utilities ARE the design system;
 * this lint keeps them that way by banning the two escape hatches — arbitrary
 * values (bg-[#fff], text-[13px]) and raw Tailwind palette (bg-red-500,
 * text-black/40) — in these files. Add each surface as it converts to utilities.
 */
const MIGRATED_COMPONENTS = ["app/v2/layout.tsx", "components/v2/V2Shell.tsx"];

const PALETTE = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow",
  "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet",
  "purple", "fuchsia", "pink", "rose",
].join("|");

const COMPONENT_RULES = [
  {
    name: "arbitrary-value class (use a register utility)",
    re: /(?:bg|text|border|ring|fill|stroke|shadow|rounded|p|px|py|m|mx|my|gap|h|w|min-h|max-w|leading|tracking|font|duration)-\[[^\]]+\]/g,
  },
  { name: "raw Tailwind palette utility", re: new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:${PALETTE})-\\d{2,3}\\b`, "g") },
  { name: "raw black/white opacity utility", re: /\b(?:bg|text|border|ring)-(?:black|white)\/\d/g },
  { name: "hex literal in class", re: /#[0-9a-fA-F]{3,8}\b/g },
];

/** Simple grep rules: any match is a violation. */
const RULES = [
  { name: "hex color", re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "rgb/rgba literal", re: /\brgba?\(/g },
  { name: "px font-size", re: /font-size:\s*[\d.]+px/g },
  { name: "px border-radius", re: /border-radius:\s*[^;]*\b[\d.]+px/g },
  { name: "gradient on a surface", re: /(?:linear|radial)-gradient\(/g },
];

/**
 * box-shadow needs a value check, not a lookahead (a lookahead lets \s* backtrack
 * and false-match `none`). Any declared shadow whose value is not `none` and does
 * not lead with the sanctioned transient token is a relief violation.
 */
function shadowViolations(css) {
  const bad = [];
  for (const m of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
    const value = m[1].trim();
    if (value === "none") continue;
    if (value.startsWith("var(--cr-shadow-transient)")) continue;
    bad.push(value);
  }
  return bad;
}

let failures = 0;
for (const file of MIGRATED) {
  let css;
  try {
    css = readFileSync(file, "utf8");
  } catch {
    console.error(`✗ cannot read ${file}`);
    failures++;
    continue;
  }
  for (const rule of RULES) {
    const hits = css.match(rule.re);
    if (hits) {
      failures++;
      console.error(`✗ ${file}: ${rule.name} — ${[...new Set(hits)].join(", ")}`);
    }
  }
  const shadows = shadowViolations(css);
  if (shadows.length) {
    failures++;
    console.error(
      `✗ ${file}: static/relief box-shadow (only none or var(--cr-shadow-transient)) — ${[
        ...new Set(shadows),
      ].join(" | ")}`,
    );
  }
}

for (const rel of MIGRATED_COMPONENTS) {
  const file = src(rel);
  let code;
  try {
    code = readFileSync(file, "utf8");
  } catch {
    console.error(`✗ cannot read ${file}`);
    failures++;
    continue;
  }
  for (const rule of COMPONENT_RULES) {
    const hits = code.match(rule.re);
    if (hits) {
      failures++;
      console.error(`✗ ${file}: ${rule.name} — ${[...new Set(hits)].join(", ")}`);
    }
  }
}

if (failures > 0) {
  console.error(`\nconsole-register lint failed: ${failures} violation(s).`);
  process.exit(1);
}
console.log(
  `console-register lint clean (${MIGRATED.length} CSS + ${MIGRATED_COMPONENTS.length} component file(s)).`,
);
