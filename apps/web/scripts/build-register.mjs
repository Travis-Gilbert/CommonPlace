/**
 * Emit the console register (CR1).
 *
 * Calls the solved `console` fixture from @travis-gilbert/markdown-theory and
 * writes src/styles/console-register.css under the --cr-* namespace. That file
 * is the single source of every color, size, radius, and duration new-shell
 * (v2) components may reference; a component that hardcodes a value is a lint
 * failure. To restyle the whole console, change CONSOLE_AXES upstream (or sweep
 * /dev/register), rebuild markdown-theory, and re-run this script — no component
 * edits. The emitted file is committed so the deploy never regenerates it.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { console as consoleRegister, emitCss } from "@travis-gilbert/markdown-theory/tokens";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "styles", "console-register.css");

const reg = consoleRegister();

// The register solver already gates on WCAG AA, but re-assert here so a bad
// axis sweep can never emit an inaccessible sheet into the repo.
const failures = reg.contrast.filter((c) => !c.passesAA);
if (failures.length > 0) {
  console.error("Console register fails WCAG AA:", failures);
  process.exit(1);
}

const contrastLine = reg.contrast.map((c) => `${c.pair} ${c.wcag}:1`).join(" · ");
const header =
  `/* GENERATED — do not edit by hand.\n` +
  `   Source: @travis-gilbert/markdown-theory \`console\` fixture (density: chrome).\n` +
  `   Regenerate: npm run build:register (after rebuilding markdown-theory, or sweeping /dev/register).\n` +
  `   Contrast (WCAG AA solved): ${contrastLine} */\n`;

writeFileSync(outPath, header + emitCss(reg, ":root", { prefix: "cr" }));
console.log(`Wrote console register → ${outPath}`);
