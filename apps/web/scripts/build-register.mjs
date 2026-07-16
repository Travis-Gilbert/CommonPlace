/**
 * Emit the console register (CR1).
 *
 * Calls the solved `console` fixture from @travis-gilbert/markdown-theory and
 * writes src/styles/console-register.css under the --cr-* namespace. That file
 * is the single source of every color, size, radius, and duration new-shell
 * (v2) components may reference; a component that hardcodes a value is a lint
 * failure. To restyle the whole console, change CONSOLE_AXES upstream (or sweep
 * /dev/register), rebuild markdown-theory, and re-run this script.
 *
 * HP2 (console-paint): the fixture's plane steps (ground = surface minus ~0.022
 * L) are below perceptual threshold on the near-white parchment values, so the
 * sidebar (ground) and content sheet (surface) bleed together. The package Axes
 * expose no plane-step knob and the steps are fixed inside buildPalette, so we
 * widen the ground here, in the repo-owned generator, by GROUND_DROP OKLCH L.
 * The ground plane does not feed ink solving (ink is solved against surface), so
 * every "on surface" pair the solver already cleared is untouched. The one thing
 * this changes is the ground plane, which the sidebar paints, so we assert AA on
 * ground below: ink and ink2 carry the small nav text (target 4.5); ink3 is
 * faint apparatus and signal/link are large or accent on the sidebar (target 3,
 * the same AA-large threshold the register already assigns ink3).
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  console as consoleRegister,
  emitCss,
  wcagContrast,
  oklchCss,
} from "@travis-gilbert/markdown-theory/tokens";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "styles", "console-register.css");

/** Additional OKLCH lightness to drop the ground plane below surface (HP2). */
const GROUND_DROP = 0.03;

/** Parse an `oklch(L% C H)` string into { l, c, h } with l in [0, 1]. */
function parseOklch(str) {
  const m = String(str).match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) throw new Error(`cannot parse oklch: ${str}`);
  return { l: parseFloat(m[1]) / 100, c: parseFloat(m[2]), h: parseFloat(m[3]) };
}

const stock = consoleRegister();

const stockGround = parseOklch(stock.palette.ground);
const widenedGround = { l: Number((stockGround.l - GROUND_DROP).toFixed(4)), c: stockGround.c, h: stockGround.h };

// New register with the widened ground swapped in (spread avoids mutating a
// possibly-frozen fixture object).
const reg = { ...stock, palette: { ...stock.palette, ground: oklchCss(widenedGround) } };

// On-surface gate: unchanged pairs the solver already cleared.
const onSurfaceFailures = reg.contrast.filter((c) => !c.passesAA);

// On-ground gate: the sidebar renders ink on ground; nothing verified that before.
const ON_GROUND_TARGETS = { ink: 4.5, ink2: 4.5, ink3: 3, signal: 3, link: 3 };
const onGround = Object.entries(ON_GROUND_TARGETS).map(([role, target]) => {
  const ratio = wcagContrast(parseOklch(reg.palette[role]), widenedGround);
  return { pair: `${role} on ground`, wcag: Number(ratio.toFixed(3)), target, passesAA: ratio >= target };
});
const onGroundFailures = onGround.filter((c) => !c.passesAA);

if (onSurfaceFailures.length > 0 || onGroundFailures.length > 0) {
  console.error("Console register fails WCAG AA:", [...onSurfaceFailures, ...onGroundFailures]);
  process.exit(1);
}

const contrastLine = [...reg.contrast, ...onGround].map((c) => `${c.pair} ${c.wcag}:1`).join(" · ");
const header =
  `/* GENERATED: do not edit by hand.\n` +
  `   Source: @travis-gilbert/markdown-theory \`console\` fixture (density: chrome); ground widened +${GROUND_DROP} OKLCH L (HP2).\n` +
  `   Regenerate: npm run build:register.\n` +
  `   Contrast (WCAG AA solved, both planes): ${contrastLine} */\n`;

writeFileSync(outPath, header + emitCss(reg, ":root", { prefix: "cr" }));
console.log(`Wrote console register -> ${outPath} (ground ${oklchCss(widenedGround)}, delta ${(parseOklch(reg.palette.surface).l - widenedGround.l).toFixed(4)} L)`);
