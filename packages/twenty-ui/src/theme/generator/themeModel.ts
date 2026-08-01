// SOURCING: twenty-ui (hard fork, this package) reskinned onto the CommonPlace
// register model vendored in ./commonplaceTokens.ts. No new component surface:
// this file only re-binds the forked theme's existing slots, which upstream
// filled from @radix-ui/colors, to console register tokens.
//
// The reskin seam. Every twenty-ui theme slot is bound here, once, to a
// CommonPlace token. Nothing else in the fork names a color.
//
// Two binding kinds, and the distinction is the whole design:
//
//   Semantic slots (surfaces, ink, accent, border, status, shadow, radius) bind
//   by REFERENCE to the console register: `var(--ij-chrome)`, not a snapshot of
//   what --ij-chrome resolved to. Light and dark, the console's two-knob theme
//   engine, and its Primer presets therefore reach fork components without the
//   fork participating.
//
//   The 25-name record palette is a namespace the console register does not
//   carry, so it is DERIVED from the same OKLCH model under the same chroma
//   clamp (see commonplaceTokens.ts). Where the console does own a hue, the
//   tag surfaces bind to that register slot so a fork Tag and a console row
//   tint cannot drift.
//
// THEME_COMMON is not re-bound. Twenty's proportions survive as structure.

import {
  MATERIALS,
  PALETTE_HUES,
  RADIUS,
  type Mode,
  type ThemeColorName,
  paletteShade,
  paletteShadeAlpha,
  rec,
  reg,
  REGISTER_HUE_SLOTS,
} from './commonplaceTokens';

export type { Mode, ThemeColorName };

export const THEME_COLOR_NAMES = Object.keys(PALETTE_HUES) as ThemeColorName[];

/** Upstream's MAIN_COLORS key order, preserved so `getNextThemeColor` cycles
 *  through the same sequence a record has always cycled through. */
export const MAIN_COLOR_ORDER: readonly ThemeColorName[] = [
  'red', 'ruby', 'crimson', 'tomato',
  'orange', 'amber', 'yellow',
  'lime', 'grass', 'green', 'jade', 'mint',
  'turquoise', 'cyan', 'sky', 'blue',
  'iris', 'violet', 'purple', 'plum', 'pink',
  'bronze', 'gold', 'brown', 'gray',
];

const SHADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * The neutral ladder. twenty-ui addresses grays background-to-foreground in
 * both modes; the console register addresses them dark-to-light in both modes.
 * Light therefore walks the register ladder backwards. This is the one place
 * that inversion is written down.
 */
function grayScale(mode: Mode): Record<string, string> {
  const registerSteps =
    mode === 'dark'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      : [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 3, 2];
  return Object.fromEntries(
    registerSteps.map((step, index) => [`gray${index + 1}`, reg(`gray-${step}`)]),
  );
}

/** Alpha overlays, derived from the register's own ink rather than white/black
 *  literals, so a tinted register tints its own overlays. */
function grayScaleAlpha(mode: Mode): Record<string, string> {
  const alphas = [3.1, 5.9, 4.7, 7.1, 10.2, 11.4, 14.1, 22, 42.7, 47.8, 56.5, 91];
  const source = mode === 'dark' ? reg('ink-bright') : reg('gray-1');
  return Object.fromEntries(
    alphas.map((alpha, index) => [
      `gray${index + 1}`,
      `color-mix(in oklab, ${source} ${alpha}%, transparent)`,
    ]),
  );
}

/** The 25-name palette's flat solid entry per name. */
function mainColors(mode: Mode): Record<string, string> {
  return Object.fromEntries(
    MAIN_COLOR_ORDER.map((name) => [
      name,
      name === 'gray' ? reg('gray-9') : paletteShade(name, 9, mode),
    ]),
  );
}

function secondaryColors(mode: Mode): Record<string, string> {
  const entries: [string, string][] = [];
  for (const name of THEME_COLOR_NAMES) {
    for (const shade of SHADES) {
      entries.push([`${name}${shade}`, paletteShade(name, shade, mode)]);
    }
  }
  return Object.fromEntries(entries);
}

function transparentColors(mode: Mode): Record<string, string> {
  const entries: [string, string][] = [];
  for (const name of THEME_COLOR_NAMES) {
    for (const shade of SHADES) {
      entries.push([`${name}${shade}`, paletteShadeAlpha(name, shade, mode)]);
    }
  }
  return Object.fromEntries(entries);
}

function accent(): Record<string, string> {
  // The accent slot is the console's, including its brand override path. The
  // 1..12 ladder rides the register's blue ramp, which both registers define.
  const ladder = Object.fromEntries(
    SHADES.map((shade) => [
      `accent${shade}`,
      reg(`blue-${Math.min(shade, 11)}`),
    ]),
  );
  return {
    primary: reg('accent'),
    secondary: reg('accent-hover'),
    tertiary: reg('selection'),
    quaternary: reg('selection-inactive'),
    accent3570: reg('accent'),
    accent4060: reg('accent-hover'),
    ...ladder,
  };
}

function background(): Record<string, unknown> {
  return {
    // The console's ambient grain is the WebGL MaterialLayer behind the frame.
    // A CSS noise layer here would paint over it.
    noisy: 'transparent',
    primary: reg('editor'),
    secondary: reg('chrome'),
    tertiary: reg('raised'),
    quaternary: reg('tier-floating'),
    invertedPrimary: reg('ink'),
    invertedSecondary: reg('ink-info'),
    danger: reg('error-bg'),
    transparent: {
      primary: reg('tier-scrim'),
      secondary: reg('tier-scrim'),
      strong: reg('pressed-overlay'),
      medium: reg('hover-overlay'),
      light: reg('hover-surface'),
      lighter: reg('keyline-decorative'),
      danger: reg('error-bg'),
      blue: reg('selection'),
      orange: reg('warn-bg'),
      success: reg('ok-bg'),
    },
    overlayPrimary: reg('tier-scrim'),
    overlaySecondary: reg('tier-scrim'),
    overlayTertiary: reg('tier-scrim'),
    // The gradient geometry is Twenty's proportion; the stops are the
    // register's.
    radialGradient: `radial-gradient(50% 62.62% at 50% 0%, ${reg('tier-raised')} 0%, ${reg('tier-floating')} 100%)`,
    radialGradientHover: `radial-gradient(76.32% 95.59% at 50% 0%, ${reg('tier-floating')} 0%, ${reg('raised')} 100%)`,
    primaryInverted: reg('ink'),
    primaryInvertedHover: reg('ink-info'),
  };
}

function border(): Record<string, unknown> {
  return {
    color: {
      strong: reg('control-border'),
      medium: reg('divider'),
      light: reg('seam'),
      secondaryInverted: reg('ink-info'),
      inverted: reg('ink'),
      danger: reg('error'),
      blue: reg('accent'),
      transparentStrong: reg('keyline-decorative'),
    },
    radius: {
      // The radius law. Upstream's xs was 2px, below the arc-antialias floor
      // the console geometry spec sets; it lands on the chip radius instead.
      xs: RADIUS.chip,
      sm: RADIUS.chip,
      md: RADIUS.control,
      smRound: RADIUS.chip,
      mdRound: RADIUS.control,
      lg: RADIUS.sunken,
      xl: RADIUS.lg,
      xxl: RADIUS.xl,
      pill: RADIUS.pill,
      rounded: RADIUS.rounded,
    },
  };
}

function font(): Record<string, unknown> {
  return {
    color: {
      primary: reg('ink'),
      secondary: reg('ink-info'),
      tertiary: reg('ink-disabled'),
      light: reg('ink-disabled'),
      extraLight: reg('gray-7'),
      inverted: reg('editor'),
      danger: reg('error'),
    },
    // Sizes and weights are proportions and survive verbatim. The family is
    // the console's UI face; weights already sit inside the --rec- cap of 600.
    size: {
      xxs: '0.625rem',
      xs: '0.85rem',
      sm: '0.92rem',
      md: '1rem',
      lg: '1.23rem',
      xl: '1.54rem',
      xxl: '1.85rem',
    },
    weight: {
      regular: 400,
      medium: 500,
      semiBold: 600,
    },
    family: reg('font-ui'),
  };
}

function boxShadow(): Record<string, string> {
  return {
    color: reg('tier-scrim'),
    light: MATERIALS.lifted.shadow,
    strong: MATERIALS.lifted.shadow,
    underline: MATERIALS.docked.shadow,
    superHeavy: MATERIALS.lifted.shadow,
  };
}

function blur(): Record<string, string> {
  // Filter recipes, not paint. Kept as upstream structure.
  return {
    light: 'blur(6px) saturate(200%) contrast(100%) brightness(130%)',
    medium: 'blur(12px) saturate(200%) contrast(100%) brightness(130%)',
    strong: 'blur(20px) saturate(200%) contrast(100%) brightness(130%)',
  };
}

function code(): Record<string, unknown> {
  return {
    text: {
      gray: reg('ink-info'),
      sky: reg('link'),
      pink: reg('room'),
      orange: reg('agent'),
      green: reg('memory'),
    },
    font: { family: reg('font-mono') },
  };
}

function snackBar(): Record<string, unknown> {
  return {
    success: { color: reg('ok'), backgroundColor: reg('ok-bg') },
    error: { color: reg('error'), backgroundColor: reg('error-bg') },
    warning: { color: reg('warn'), backgroundColor: reg('warn-bg') },
    info: { color: reg('accent'), backgroundColor: reg('selection') },
    default: { color: reg('ink'), backgroundColor: reg('hover-surface') },
  };
}

function tag(mode: Mode): Record<string, unknown> {
  const text: Record<string, string> = {};
  const backgroundColors: Record<string, string> = {};
  for (const name of THEME_COLOR_NAMES) {
    const slot = REGISTER_HUE_SLOTS[name];
    text[name] = slot ? slot.ink : paletteShade(name, 11, mode);
    backgroundColors[name] = slot ? slot.tint : paletteShade(name, 3, mode);
  }
  return { text, background: backgroundColors };
}

function illustrationIcon(): Record<string, unknown> {
  return {
    color: { blue: reg('accent'), gray: reg('ink-disabled') },
    fill: { blue: reg('selection'), gray: reg('raised') },
  };
}

/**
 * The full per-mode theme, matching the upstream object shape field for field
 * so no component needs an edit. THEME_COMMON is spread in by the emitted
 * ThemeLight / ThemeDark files, not here.
 */
export function buildThemeVariant(mode: Mode) {
  return {
    accent: accent(),
    background: background(),
    blur: blur(),
    border: border(),
    boxShadow: boxShadow(),
    font: font(),
    name: mode,
    snackBar: snackBar(),
    tag: tag(mode),
    code: code(),
    IllustrationIcon: illustrationIcon(),
    grayScale: grayScale(mode),
    grayScaleAlpha: grayScaleAlpha(mode),
    mainColors: mainColors(mode),
    secondaryColors: secondaryColors(mode),
    transparentColors: transparentColors(mode),
  };
}

/**
 * THEME_COMMON, preserved from upstream field for field. It is the proportions
 * layer: the 4px grid, the animation durations, and the record table metrics
 * the console already carries as --rec-*. Values are upstream's; the record
 * metrics point at the --rec- group, which was extracted from these exact
 * fields, so the two cannot drift.
 */
export const THEME_COMMON_MODEL = {
  icon: {
    size: { sm: 14, md: 16, lg: 20, xl: 24 },
    stroke: { sm: 1.6, md: 2, lg: 2.5 },
  },
  modal: {
    size: {
      sm: { width: '300px' },
      md: { width: '400px' },
      lg: { width: '53%' },
      xl: { width: '1200px', height: '800px' },
      fullscreen: { width: '100dvw', height: '100dvh' },
    },
  },
  text: {
    lineHeight: { lg: 1.5, md: 1.1 },
    iconSizeMedium: 16,
    iconSizeSmall: 14,
    iconStrikeLight: 1.6,
    iconStrikeMedium: 2,
    iconStrikeBold: 2.5,
  },
  animation: {
    duration: { instant: 0.075, fast: 0.15, normal: 0.3, slow: 1.5 },
  },
  spacingMultiplicator: 4,
  betweenSiblingsGap: rec('sibling-gap'),
  table: {
    horizontalCellMargin: rec('cell-margin'),
    checkboxColumnWidth: rec('utility-col'),
    horizontalCellPadding: rec('cell-pad'),
  },
  sidePanelWidth: rec('side-panel'),
  clickableElementBackgroundTransition: rec('clickable-transition'),
  lastLayerZIndex: 2147483647,
  buttons: { secondaryTextColor: reg('ink-info') },
} as const;
