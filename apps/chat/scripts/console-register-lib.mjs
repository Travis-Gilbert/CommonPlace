// SOURCING: none. Pure logic over the console's own register files.
//
// SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3, named choice 5 ("one token truth,
// two generators"). The chat register is a separate Vite app: it cannot import
// the Next console's stylesheets at runtime, so the console's token values are
// materialized into apps/chat/src/styles/console-register.css at generate time
// and drift-checked in CI.
//
// The two apps disagree about which mode is default. The console defines dark
// under a bare [data-register="intui"] and light as a [data-theme="light"]
// override; the fork's default is light with a .dark override. Composing
// dark then light for the fork's :root reproduces exactly what the console's
// cascade resolves: it is materialized here, not reinvented.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const chatRoot = path.resolve(here, '..');
export const consoleStyles = path.resolve(chatRoot, '../console/src/styles');
export const OUTPUT_PATH = path.join(chatRoot, 'src/styles/console-register.css');

/**
 * Register files read, in cascade order. Later files override earlier ones.
 * gy-bridge is here because --cp-font-machine chains through --gy-font-mono;
 * the bridge is the file that re-points the Galley tokens at the Int UI
 * register, so it is the console's own answer for that indirection.
 */
export const SOURCE_FILES = [
  'galley-register.css',
  'int-ui-register.css',
  'int-ui-register-light.css',
  'register-bridge.css',
  'gy-bridge.css',
];

const DARK_SELECTOR = '[data-register="intui"]';
const LIGHT_SELECTOR = '[data-register="intui"][data-theme="light"]';

/** Token families the fork consumes. Everything else stays console-only. */
const TOKEN_PREFIX = /^--(ij|cp|gy)-/;

/**
 * next/font renames families at build time and exposes them as
 * --font-console-*. The Vite app has no next/font, so those heads resolve to
 * nothing and the stack silently falls through to the system face. The fork
 * self-hosts the same families from @fontsource and drops the dead head; the
 * literal family name that follows is the same one the console loads.
 */
const NEXT_FONT_HEAD = /var\(--font-console-[a-z]+\),\s*/g;

/**
 * Split a register file into top-level blocks, tracking brace depth so nested
 * rules (@media, descendant selectors) never leak into a parent's declarations.
 * Comments are stripped first: they legitimately contain braces and colons.
 */
function topLevelBlocks(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = -1;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      if (depth === 0) {
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push({
          selector: source.slice(selectorStart, bodyStart - 1).trim(),
          body: source.slice(bodyStart, index),
        });
        selectorStart = index + 1;
      }
    }
  }
  return blocks;
}

/** Collect `--ij-*` / `--cp-*` declarations from one block body, in order. */
function declarations(body) {
  const found = [];
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1];
    if (!TOKEN_PREFIX.test(name)) continue;
    const value = match[2].replace(/\s+/g, ' ').trim().replace(NEXT_FONT_HEAD, '');
    found.push([name, value]);
  }
  return found;
}

/**
 * Read the console registers and return the two resolved token maps the fork
 * needs. `light` is the composition the console's cascade produces for light
 * mode; `dark` is the bare base.
 */
export function readConsoleRegisters() {
  const dark = new Map();
  const lightOverrides = new Map();

  for (const file of SOURCE_FILES) {
    const css = readFileSync(path.join(consoleStyles, file), 'utf8');
    for (const block of topLevelBlocks(css)) {
      // Only the two token-defining selectors. Descendant and state selectors
      // ([data-elevation], [data-island], @theme inline) are component rules
      // or Tailwind bridges; the fork emits its own bridge.
      const target = block.selector === DARK_SELECTOR
        ? dark
        : block.selector === LIGHT_SELECTOR
          ? lightOverrides
          : null;
      if (!target) continue;
      for (const [name, value] of declarations(block.body)) target.set(name, value);
    }
  }

  const light = new Map(dark);
  for (const [name, value] of lightOverrides) light.set(name, value);

  assertResolvable({ dark, light });
  return { dark, light, lightOverrides };
}

/**
 * A var() head that names a token the fork does not emit resolves to nothing:
 * the declaration is dropped and the surface silently falls back to whatever
 * the browser default is. That failure is invisible in review and invisible in
 * a screenshot of a surface that happens not to use the token, so it is a hard
 * error here. If this fires, the missing token's owning register belongs in
 * SOURCE_FILES.
 */
function assertResolvable(modes) {
  const problems = [];
  for (const [mode, tokens] of Object.entries(modes)) {
    for (const [name, value] of tokens) {
      for (const reference of value.matchAll(/var\((--[a-z0-9-]+)/gi)) {
        if (!tokens.has(reference[1])) {
          problems.push(`${mode}: ${name} references ${reference[1]}, which no source register defines`);
        }
      }
    }
  }
  if (problems.length) {
    throw new Error(`Console register has unresolvable references:\n  ${problems.join('\n  ')}`);
  }
}

function emitBlock(selector, tokens, indent = '  ') {
  const lines = [`${selector} {`];
  for (const [name, value] of tokens) lines.push(`${indent}${name}: ${value};`);
  lines.push('}');
  return lines.join('\n');
}

/** Render the generated stylesheet. Pure: same registers in, same bytes out. */
export function renderConsoleRegister({ dark, light }) {
  const header = `/* GENERATED by scripts/generate-console-register.mjs. Do not edit.
   SPEC-COMMONPLACE-OPENWORK-FORK-1.0 OW3 / named choice 5: one token truth.
   Source of truth: apps/console/src/styles/{${SOURCE_FILES.join(',')}}.
   The chat register is a separate Vite app and cannot import the console's
   stylesheets, so the console's resolved --ij- and --cp- values are materialized
   here. Token gaps route to the console registers, never into this file or
   into fork components. Run \`pnpm --filter @commonplace/chat tokens\` after
   any console register change; check-console-register.mjs fails on drift.

   Mode inversion: the console's bare selector is dark and light is the
   override; the fork's :root is light. :root below is the console's resolved
   light composition and the dark selector carries the bare base. */
`;

  return [
    header,
    emitBlock(':root', light),
    '',
    emitBlock('.dark,\n[data-theme="dark"]', dark),
    '',
  ].join('\n');
}
