// TW1 Solver: generates porcelain-theme.css from measured Twenty proportions.
//
// The measured facts are the source of truth. Adjust an axis (type-scale-ratio,
// spacing-unit, etc.) and re-run to regenerate the CSS. No hex literals or px
// values live outside this file and the generated output.
//
// Usage:
//   import { generateCSS, writeTokensFile } from '@/lib/theme/porcelain-solver';
//   const css = generateCSS('porcelain');
//   await writeTokensFile(); // writes to styles/porcelain-theme.css

import { writeFileSync } from 'fs';
import { resolve } from 'path';

// ── Measured Facts (from running Twenty product) ──

/** Proportions measured from the running Twenty product. These are observable
 *  facts, not copyrightable expression. Never change these unless re-measuring. */
export const MEASURED = {
  text: {
    xxs: 10,
    xs: 13.6,
    sm: 14.72,
    md: 16,
    lg: 19.68,
    xl: 24.64,
    xxl: 29.6,
  },
  icon: { sm: 14, md: 16, lg: 20, xl: 24 },
  radii: { chip: 4, control: 8, row: 8, band: 16, pill: 999 },
  grid: 4,
  table: { cellPadX: 8, cellMarginX: 8, checkboxCol: 32 },
  motion: { instant: 75, fast: 150, normal: 300, slow: 1500 },
} as const;

// ── Adjustable Axes ──

export interface SolverAxes {
  /** Base font size in px. Affects the rem scale. Default: 16 */
  baseFontSize: number;
  /** Spacing grid unit in px. All spacing tokens are multiples. Default: 4 */
  spacingUnit: number;
  /** Compactness factor applied to padding/margins. 1.0 = full. 0.75 = compact. */
  compactness: number;
}

export const DEFAULT_AXES: SolverAxes = {
  baseFontSize: 16,
  spacingUnit: 4,
  compactness: 1.0,
};

// ── Color inventory (ours — not from Twenty) ──

interface TagColors {
  ink: string;
  bg: string;
  line: string;
}

interface ColorInventory {
  g0: string;
  g1: string;
  plane: string;
  raised: string;
  insetBg: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  accentInk: string;
  hair: string;
  hairSoft: string;
  ok: string;
  teal: string;
  tealSoft: string;
  tealLine: string;
  amber: string;
  amberSoft: string;
  amberLine: string;
  navy: string;
  navySoft: string;
  tags: Record<string, TagColors>;
  edge: string;
  raise: string;
  float: string;
  well: string;
}

const TAG_NAMES = ['grey', 'yellow', 'orange', 'red', 'pink', 'purple', 'blue', 'sky', 'teal', 'green'] as const;

const PORCELAIN_COLORS: ColorInventory = {
  g0: '#FFFFFF',
  g1: '#F1F1F1',
  plane: '#FFFFFF',
  raised: '#FFFFFF',
  insetBg: '#F1F1F1',
  ink: '#1A1A1A',
  inkDim: '#666666',
  inkFaint: '#999999',
  accent: '#8A2E29',
  accentDeep: '#71231F',
  accentSoft: 'rgba(138, 46, 41, 0.08)',
  accentInk: '#FBF3E4',
  hair: 'rgba(0, 0, 0, 0.08)',
  hairSoft: 'rgba(0, 0, 0, 0.05)',
  ok: '#3D7A4A',
  teal: '#2E6F69',
  tealSoft: 'rgba(46, 111, 105, 0.1)',
  tealLine: 'rgba(46, 111, 105, 0.28)',
  amber: '#9A6A14',
  amberSoft: 'rgba(154, 106, 20, 0.12)',
  amberLine: 'rgba(154, 106, 20, 0.34)',
  navy: '#33455C',
  navySoft: 'rgba(51, 69, 92, 0.12)',
  tags: {
    grey: { ink: '#6B665C', bg: 'rgba(107, 102, 92, 0.10)', line: 'rgba(107, 102, 92, 0.22)' },
    yellow: { ink: '#8A6A12', bg: 'rgba(154, 120, 20, 0.13)', line: 'rgba(154, 120, 20, 0.30)' },
    orange: { ink: '#A2531F', bg: 'rgba(162, 83, 31, 0.12)', line: 'rgba(162, 83, 31, 0.30)' },
    red: { ink: '#9A2E29', bg: 'rgba(154, 46, 41, 0.10)', line: 'rgba(154, 46, 41, 0.26)' },
    pink: { ink: '#97386A', bg: 'rgba(151, 56, 106, 0.11)', line: 'rgba(151, 56, 106, 0.28)' },
    purple: { ink: '#64499A', bg: 'rgba(100, 73, 154, 0.11)', line: 'rgba(100, 73, 154, 0.28)' },
    blue: { ink: '#33455C', bg: 'rgba(51, 69, 92, 0.11)', line: 'rgba(51, 69, 92, 0.28)' },
    sky: { ink: '#2E6A8A', bg: 'rgba(46, 106, 138, 0.12)', line: 'rgba(46, 106, 138, 0.28)' },
    teal: { ink: '#2E6F69', bg: 'rgba(46, 111, 105, 0.11)', line: 'rgba(46, 111, 105, 0.28)' },
    green: { ink: '#3D7A4A', bg: 'rgba(61, 122, 74, 0.11)', line: 'rgba(61, 122, 74, 0.28)' },
  },
  edge: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',
  raise: '0px 2px 4px 0px rgba(0, 0, 0, 0.04), 0px 0px 4px 0px rgba(0, 0, 0, 0.02)',
  float: '2px 4px 16px 0px rgba(0, 0, 0, 0.08), 0px 2px 4px 0px rgba(0, 0, 0, 0.04)',
  well: 'inset 0 1px 2px rgba(0, 0, 0, 0.06)',
};

const UMBER_COLORS: ColorInventory = {
  g0: '#1A1A1A',
  g1: '#141414',
  plane: '#222222',
  raised: '#1E1E1E',
  insetBg: '#161616',
  ink: '#E5E5E5',
  inkDim: '#999999',
  inkFaint: '#777777',
  accent: '#C4453D',
  accentDeep: '#A5352E',
  accentSoft: 'rgba(196, 69, 61, 0.14)',
  accentInk: '#1A0E0C',
  hair: 'rgba(255, 255, 255, 0.08)',
  hairSoft: 'rgba(255, 255, 255, 0.05)',
  ok: '#5FA871',
  teal: '#6FB3AB',
  tealSoft: 'rgba(111, 179, 171, 0.14)',
  tealLine: 'rgba(111, 179, 171, 0.32)',
  amber: '#D9A84E',
  amberSoft: 'rgba(217, 168, 78, 0.16)',
  amberLine: 'rgba(217, 168, 78, 0.36)',
  navy: '#9DB2C7',
  navySoft: 'rgba(157, 178, 199, 0.16)',
  tags: {
    grey: { ink: '#B4AB98', bg: 'rgba(180, 171, 152, 0.14)', line: 'rgba(180, 171, 152, 0.28)' },
    yellow: { ink: '#D9A84E', bg: 'rgba(217, 168, 78, 0.16)', line: 'rgba(217, 168, 78, 0.34)' },
    orange: { ink: '#D98E5A', bg: 'rgba(217, 142, 90, 0.16)', line: 'rgba(217, 142, 90, 0.34)' },
    red: { ink: '#D9756E', bg: 'rgba(217, 117, 110, 0.16)', line: 'rgba(217, 117, 110, 0.34)' },
    pink: { ink: '#D983B0', bg: 'rgba(217, 131, 176, 0.16)', line: 'rgba(217, 131, 176, 0.32)' },
    purple: { ink: '#AF95DA', bg: 'rgba(175, 149, 218, 0.16)', line: 'rgba(175, 149, 218, 0.32)' },
    blue: { ink: '#9DB2C7', bg: 'rgba(157, 178, 199, 0.16)', line: 'rgba(157, 178, 199, 0.32)' },
    sky: { ink: '#86BBD8', bg: 'rgba(134, 187, 216, 0.16)', line: 'rgba(134, 187, 216, 0.32)' },
    teal: { ink: '#6FB3AB', bg: 'rgba(111, 179, 171, 0.16)', line: 'rgba(111, 179, 171, 0.32)' },
    green: { ink: '#6FBE81', bg: 'rgba(111, 190, 129, 0.16)', line: 'rgba(111, 190, 129, 0.32)' },
  },
  edge: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
  raise: '0px 2px 4px 0px rgba(0, 0, 0, 0.3), 0px 0px 4px 0px rgba(0, 0, 0, 0.15)',
  float: '2px 4px 16px 0px rgba(0, 0, 0, 0.4), 0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
  well: 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
};

// ── Type Ramp Computation ──

/** Compute rem values from the measured px sizes using the given base font size. */
function computeTypeRamp(axes: SolverAxes): Record<string, string> {
  return {
    xxs: `${(MEASURED.text.xxs / axes.baseFontSize).toFixed(3)}rem`,
    xs: `${(MEASURED.text.xs / axes.baseFontSize).toFixed(2)}rem`,
    sm: `${(MEASURED.text.sm / axes.baseFontSize).toFixed(2)}rem`,
    md: '1rem',
    lg: `${(MEASURED.text.lg / axes.baseFontSize).toFixed(2)}rem`,
    xl: `${(MEASURED.text.xl / axes.baseFontSize).toFixed(2)}rem`,
    xxl: `${(MEASURED.text.xxl / axes.baseFontSize).toFixed(2)}rem`,
  };
}

/** Compute spacing tokens from the grid unit. */
function computeSpacing(axes: SolverAxes): Record<string, string> {
  const u = axes.spacingUnit;
  return {
    '--u': `${u * 2}px`,
    '--grid': `${u}px`,
    '--space-0': '0',
    '--space-1': `calc(var(--grid) * 1)`,
    '--space-2': `calc(var(--grid) * 2)`,
    '--space-3': `calc(var(--grid) * 3)`,
    '--space-4': `calc(var(--grid) * 4)`,
    '--space-5': `calc(var(--grid) * 5)`,
    '--space-6': `calc(var(--grid) * 6)`,
    '--space-8': `calc(var(--grid) * 8)`,
    '--space-10': `calc(var(--grid) * 10)`,
    '--space-12': `calc(var(--grid) * 12)`,
    '--space-16': `calc(var(--grid) * 16)`,
  };
}

// ── CSS Generation ──

function colorBlock(inventory: ColorInventory): string {
  const lines: string[] = [];
  lines.push(`  --g0: ${inventory.g0};`);
  lines.push(`  --g1: ${inventory.g1};`);
  lines.push('');
  lines.push(`  --plane: ${inventory.plane};`);
  lines.push(`  --raised: ${inventory.raised};`);
  lines.push(`  --inset-bg: ${inventory.insetBg};`);
  lines.push('');
  lines.push(`  --ink: ${inventory.ink};`);
  lines.push(`  --ink-dim: ${inventory.inkDim};`);
  lines.push(`  --ink-faint: ${inventory.inkFaint};`);
  lines.push('');
  lines.push(`  --accent: ${inventory.accent};`);
  lines.push(`  --accent-deep: ${inventory.accentDeep};`);
  lines.push(`  --accent-soft: ${inventory.accentSoft};`);
  lines.push(`  --accent-ink: ${inventory.accentInk};`);
  lines.push('');
  lines.push(`  --hair: ${inventory.hair};`);
  lines.push(`  --hair-soft: ${inventory.hairSoft};`);
  lines.push('');
  lines.push(`  --ok: ${inventory.ok};`);
  lines.push(`  --teal: ${inventory.teal};`);
  lines.push(`  --teal-soft: ${inventory.tealSoft};`);
  lines.push(`  --teal-line: ${inventory.tealLine};`);
  lines.push(`  --amber: ${inventory.amber};`);
  lines.push(`  --amber-soft: ${inventory.amberSoft};`);
  lines.push(`  --amber-line: ${inventory.amberLine};`);
  lines.push(`  --navy: ${inventory.navy};`);
  lines.push(`  --navy-soft: ${inventory.navySoft};`);
  lines.push('');

  for (const name of TAG_NAMES) {
    const t = inventory.tags[name];
    lines.push(`  --tag-${name}: ${t.ink};   --tag-${name}-bg: ${t.bg};  --tag-${name}-line: ${t.line};`);
  }
  lines.push('');

  lines.push(`  --edge: ${inventory.edge};`);
  lines.push(`  --raise: ${inventory.raise};`);
  lines.push(`  --float: ${inventory.float};`);
  lines.push(`  --well: ${inventory.well};`);
  return lines.join('\n');
}

function typographyBlock(axes: SolverAxes): string {
  const ramp = computeTypeRamp(axes);
  const lines: string[] = [];
  lines.push(`  --font-display: 'Cabinet Grotesk', 'IBM Plex Sans Condensed', sans-serif;`);
  lines.push(`  --font-body: 'IBM Plex Sans Condensed', system-ui, sans-serif;`);
  lines.push(`  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;`);
  lines.push('');
  lines.push(`  --text-xxs: ${ramp.xxs};`);
  lines.push(`  --text-xs:  ${ramp.xs};`);
  lines.push(`  --text-sm:  ${ramp.sm};`);
  lines.push(`  --text-md:  ${ramp.md};`);
  lines.push(`  --text-lg:  ${ramp.lg};`);
  lines.push(`  --text-xl:  ${ramp.xl};`);
  lines.push(`  --text-xxl: ${ramp.xxl};`);
  lines.push('');
  lines.push(`  --weight-regular:  400;`);
  lines.push(`  --weight-medium:   500;`);
  lines.push(`  --weight-semibold: 600;`);
  lines.push('');
  lines.push(`  --leading-body:    1.5;`);
  lines.push(`  --leading-heading: 1.1;`);
  return lines.join('\n');
}

function iconBlock(): string {
  return [
    `  --icon-sm:  ${MEASURED.icon.sm}px;`,
    `  --icon-md:  ${MEASURED.icon.md}px;`,
    `  --icon-lg:  ${MEASURED.icon.lg}px;`,
    `  --icon-xl:  ${MEASURED.icon.xl}px;`,
    `  --icon-stroke-sm: 1.6;`,
    `  --icon-stroke-md: 2;`,
    `  --icon-stroke-lg: 2.5;`,
  ].join('\n');
}

function geometryBlock(axes: SolverAxes): string {
  const spacing = computeSpacing(axes);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  ${key}: ${value};`);
  }
  return lines.join('\n');
}

function radiiBlock(): string {
  return [
    `  --r-chip:   ${MEASURED.radii.chip}px;`,
    `  --r-control: ${MEASURED.radii.control}px;`,
    `  --r-row:     ${MEASURED.radii.row}px;`,
    `  --r-band:   ${MEASURED.radii.band}px;`,
    `  --r-pill: ${MEASURED.radii.pill}px;`,
  ].join('\n');
}

function motionBlock(): string {
  return [
    `  --motion-instant: ${MEASURED.motion.instant}ms;`,
    `  --motion-fast:   ${MEASURED.motion.fast}ms;`,
    `  --motion:        ${MEASURED.motion.normal}ms;`,
    `  --motion-slow:   ${MEASURED.motion.slow / 1000}s;`,
    `  --ease: cubic-bezier(0.2, 0, 0, 1);`,
  ].join('\n');
}

function tableBlock(axes: SolverAxes): string {
  const c = axes.compactness;
  return [
    `  --table-cell-pad-x: ${Math.round(MEASURED.table.cellPadX * c)}px;`,
    `  --table-cell-margin-x: ${Math.round(MEASURED.table.cellMarginX * c)}px;`,
    `  --table-checkbox-col: ${MEASURED.table.checkboxCol}px;`,
  ].join('\n');
}

/** Build the complete CSS for all registers. */
export function generateCSS(axes: Partial<SolverAxes> = {}): string {
  const resolvedAxes: SolverAxes = { ...DEFAULT_AXES, ...axes };

  const header = `/* Porcelain theme — GENERATED by porcelain-solver.ts
   Do not edit this file directly. Adjust solver axes and re-run:
     pnpm gen:tokens
   ── Registers ──
   porcelain (default): white-ground, flat, Twenty-proportioned
   umber (dark): opt-in via [data-register='umber']
   ── TW1: legally clean — no hex/px from extraction in component files ── */
`;

  // Blocks that are register-dependent
  const porcelainBlocks = [
    `/* ground palette: white, flat, Twenty-proportioned */`,
    colorBlock(PORCELAIN_COLORS),
    `/* type families (ours) */`,
    typographyBlock(resolvedAxes),
    `/* icon size tokens */`,
    iconBlock(),
    `/* geometry: ${resolvedAxes.spacingUnit}px grid unit */`,
    geometryBlock(resolvedAxes),
    `/* radii: tuned to measured proportions */`,
    radiiBlock(),
    `/* motion */`,
    motionBlock(),
    `/* table tokens */`,
    tableBlock(resolvedAxes),
    `/* z-index ceiling */`,
    `  --z-max: 2147483647;`,
  ];

  const porcelainCSS = `.porcelain {\n${porcelainBlocks.join('\n\n')}\n}`;

  const umberBlocks = [
    `/* umber register: machine-active containers opt in with data-register */`,
    colorBlock(UMBER_COLORS),
    typographyBlock(resolvedAxes),
    iconBlock(),
    geometryBlock(resolvedAxes),
    radiiBlock(),
    motionBlock(),
    tableBlock(resolvedAxes),
    `  --z-max: 2147483647;`,
  ];

  const umberSelector = `.porcelain [data-register='umber'],
.porcelain[data-register='umber']`;

  const umberCSS = `${umberSelector} {\n${umberBlocks.join('\n\n')}\n}`;

  const reducedMotion = `@media (prefers-reduced-motion: reduce) {
  .porcelain {
    --motion: 0ms;
  }
}`;

  return `${header}\n${porcelainCSS}\n\n${umberCSS}\n\n${reducedMotion}\n`;
}

/** Write porcelain-theme.css to the styles directory. */
export function writeTokensFile(
  axes: Partial<SolverAxes> = {},
  outputPath?: string,
): string {
  const css = generateCSS(axes);
  const target =
    outputPath ??
    resolve(process.cwd(), 'src/styles/porcelain-theme.css');
  writeFileSync(target, css, 'utf-8');
  console.log(`✓ Porcelain tokens written to ${target}`);
  return target;
}

// ── DTCG (W3C Design Tokens) emission ──
//
// TW1 requires a measured DTCG sheet: the spacing scale, type ramp, icon sizes,
// radii, color inventory, and row/table heights as measured facts. Values are
// resolved to concrete units (no calc()) so the document is a portable record
// of the measured proportions the register calibrates to.

interface DTCGToken {
  $value: string;
  $type: 'dimension' | 'duration' | 'color';
}
type DTCGGroup = { [key: string]: DTCGToken | DTCGGroup };

const dim = (value: string): DTCGToken => ({ $value: value, $type: 'dimension' });
const dur = (value: string): DTCGToken => ({ $value: value, $type: 'duration' });
const col = (value: string): DTCGToken => ({ $value: value, $type: 'color' });

function dtcgColors(inventory: ColorInventory): DTCGGroup {
  const group: DTCGGroup = {
    g0: col(inventory.g0),
    g1: col(inventory.g1),
    plane: col(inventory.plane),
    raised: col(inventory.raised),
    'inset-bg': col(inventory.insetBg),
    ink: col(inventory.ink),
    'ink-dim': col(inventory.inkDim),
    'ink-faint': col(inventory.inkFaint),
    accent: col(inventory.accent),
    'accent-deep': col(inventory.accentDeep),
    ok: col(inventory.ok),
    teal: col(inventory.teal),
    amber: col(inventory.amber),
    navy: col(inventory.navy),
  };
  for (const name of TAG_NAMES) group[`tag-${name}`] = col(inventory.tags[name].ink);
  return group;
}

/** The measured register as a W3C DTCG token document. */
export function toDTCG(axes: Partial<SolverAxes> = {}): Record<string, unknown> {
  const resolved: SolverAxes = { ...DEFAULT_AXES, ...axes };
  const grid = resolved.spacingUnit;
  const ramp = computeTypeRamp(resolved);
  const c = resolved.compactness;

  const spaceSteps = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
  const space: DTCGGroup = { grid: dim(`${grid}px`), u: dim(`${grid * 2}px`) };
  for (const n of spaceSteps) space[String(n)] = dim(n === 0 ? '0px' : `${grid * n}px`);

  return {
    $description:
      'Porcelain register, measured-calibrated (TW1). Generated by porcelain-solver.ts; do not edit by hand. Regenerate with pnpm gen:tokens.',
    space,
    text: {
      xxs: dim(ramp.xxs),
      xs: dim(ramp.xs),
      sm: dim(ramp.sm),
      md: dim(ramp.md),
      lg: dim(ramp.lg),
      xl: dim(ramp.xl),
      xxl: dim(ramp.xxl),
    },
    icon: {
      sm: dim(`${MEASURED.icon.sm}px`),
      md: dim(`${MEASURED.icon.md}px`),
      lg: dim(`${MEASURED.icon.lg}px`),
      xl: dim(`${MEASURED.icon.xl}px`),
    },
    radius: {
      chip: dim(`${MEASURED.radii.chip}px`),
      control: dim(`${MEASURED.radii.control}px`),
      row: dim(`${MEASURED.radii.row}px`),
      band: dim(`${MEASURED.radii.band}px`),
      pill: dim(`${MEASURED.radii.pill}px`),
    },
    table: {
      'cell-pad-x': dim(`${Math.round(MEASURED.table.cellPadX * c)}px`),
      'cell-margin-x': dim(`${Math.round(MEASURED.table.cellMarginX * c)}px`),
      'checkbox-col': dim(`${MEASURED.table.checkboxCol}px`),
    },
    motion: {
      instant: dur(`${MEASURED.motion.instant}ms`),
      fast: dur(`${MEASURED.motion.fast}ms`),
      normal: dur(`${MEASURED.motion.normal}ms`),
      slow: dur(`${MEASURED.motion.slow}ms`),
    },
    color: {
      porcelain: dtcgColors(PORCELAIN_COLORS),
      umber: dtcgColors(UMBER_COLORS),
    },
  };
}

/** Write porcelain.tokens.json (DTCG) next to the generated CSS. */
export function writeDTCGFile(axes: Partial<SolverAxes> = {}, outputPath?: string): string {
  const doc = toDTCG(axes);
  const target = outputPath ?? resolve(process.cwd(), 'src/styles/porcelain.tokens.json');
  writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
  console.log(`✓ Porcelain DTCG tokens written to ${target}`);
  return target;
}

/** Collect all CSS custom property values as a flat map. Useful for testing and
 *  for the ThemeTokens contract consumed by BlockHost. */
export function tokenMap(register: 'porcelain' | 'umber', axes: Partial<SolverAxes> = {}): Record<string, string> {
  const resolvedAxes: SolverAxes = { ...DEFAULT_AXES, ...axes };
  const colors = register === 'porcelain' ? PORCELAIN_COLORS : UMBER_COLORS;
  const ramp = computeTypeRamp(resolvedAxes);
  const spacing = computeSpacing(resolvedAxes);
  const c = resolvedAxes.compactness;

  return {
    // Colors
    '--g0': colors.g0,
    '--g1': colors.g1,
    '--plane': colors.plane,
    '--raised': colors.raised,
    '--inset-bg': colors.insetBg,
    '--ink': colors.ink,
    '--ink-dim': colors.inkDim,
    '--ink-faint': colors.inkFaint,
    '--accent': colors.accent,
    '--accent-deep': colors.accentDeep,
    '--accent-soft': colors.accentSoft,
    '--accent-ink': colors.accentInk,
    '--hair': colors.hair,
    '--hair-soft': colors.hairSoft,
    '--ok': colors.ok,
    '--teal': colors.teal,
    '--teal-soft': colors.tealSoft,
    '--teal-line': colors.tealLine,
    '--amber': colors.amber,
    '--amber-soft': colors.amberSoft,
    '--amber-line': colors.amberLine,
    '--navy': colors.navy,
    '--navy-soft': colors.navySoft,
    // Tag colors
    ...Object.fromEntries(
      TAG_NAMES.flatMap((name) => {
        const t = colors.tags[name];
        return [
          [`--tag-${name}`, t.ink],
          [`--tag-${name}-bg`, t.bg],
          [`--tag-${name}-line`, t.line],
        ];
      }),
    ),
    // Shadows
    '--edge': colors.edge,
    '--raise': colors.raise,
    '--float': colors.float,
    '--well': colors.well,
    // Typography
    '--font-display': "'Cabinet Grotesk', 'IBM Plex Sans Condensed', sans-serif",
    '--font-body': "'IBM Plex Sans Condensed', system-ui, sans-serif",
    '--font-mono': "'IBM Plex Mono', ui-monospace, monospace",
    '--text-xxs': ramp.xxs,
    '--text-xs': ramp.xs,
    '--text-sm': ramp.sm,
    '--text-md': ramp.md,
    '--text-lg': ramp.lg,
    '--text-xl': ramp.xl,
    '--text-xxl': ramp.xxl,
    '--weight-regular': '400',
    '--weight-medium': '500',
    '--weight-semibold': '600',
    '--leading-body': '1.5',
    '--leading-heading': '1.1',
    // Icons
    '--icon-sm': `${MEASURED.icon.sm}px`,
    '--icon-md': `${MEASURED.icon.md}px`,
    '--icon-lg': `${MEASURED.icon.lg}px`,
    '--icon-xl': `${MEASURED.icon.xl}px`,
    '--icon-stroke-sm': '1.6',
    '--icon-stroke-md': '2',
    '--icon-stroke-lg': '2.5',
    // Spacing
    ...spacing,
    // Radii
    '--r-chip': `${MEASURED.radii.chip}px`,
    '--r-control': `${MEASURED.radii.control}px`,
    '--r-row': `${MEASURED.radii.row}px`,
    '--r-band': `${MEASURED.radii.band}px`,
    '--r-pill': `${MEASURED.radii.pill}px`,
    // Motion
    '--motion-instant': `${MEASURED.motion.instant}ms`,
    '--motion-fast': `${MEASURED.motion.fast}ms`,
    '--motion': `${MEASURED.motion.normal}ms`,
    '--motion-slow': `${MEASURED.motion.slow / 1000}s`,
    '--ease': 'cubic-bezier(0.2, 0, 0, 1)',
    // Table
    '--table-cell-pad-x': `${Math.round(MEASURED.table.cellPadX * c)}px`,
    '--table-cell-margin-x': `${Math.round(MEASURED.table.cellMarginX * c)}px`,
    '--table-checkbox-col': `${MEASURED.table.checkboxCol}px`,
    // Z
    '--z-max': '2147483647',
  };
}
