/**
 * CommonPlace mobile tokens: porcelain register v2.
 *
 * Governing mechanism: tonal elevation. Ground carries hue temperature; layers
 * differ by lightness step, not shadow. Light mode gets ONE contact shadow;
 * dark mode gets zero (depth = the surface ladder).
 *
 * Palette lineage: claude-crimson light values with real oxblood replacing the
 * crimson primary; warm dark derived from the claude.ai dark family. Oxblood
 * owns the red channel (destructive is ink, never red). Umber is the default
 * machine surface; deep teal ships as the first user-selectable alternate.
 *
 * Contrast receipts (WCAG 2.x relative luminance, computed not eyeballed):
 *   white on oxblood #7A2733          9.7:1
 *   white on oxblood dark #8A3140     8.1:1
 *   mutedText #6A5E52 on bg #faf9f5   6.0:1
 *   dark muted #A8A59D on #262624     6.1:1
 *   ink #141413 on bg #faf9f5        17.9:1
 */

export const oxblood = {
  fill: '#7A2733',
  pressed: '#66202B',
  fillDark: '#8A3140',
  pressedDark: '#7A2733',
  washLight: '#F6E6E5',
  washDark: 'rgba(138, 49, 64, 0.16)',
} as const;

export const lightColors = {
  deep: '#F5F4EE', // sidebar step, below ground
  bg: '#FAF9F5',
  surface: '#FAF9F5',
  raised: '#FFFFFF', // popover step
  secondary: '#E9E6DC',
  muted: '#EDE9DE',
  border: '#DAD9D4',
  input: '#B4B2A7',
  text: '#141413',
  textMuted: '#6A5E52',
  textFaint: '#8A857B',
  primary: oxblood.fill,
  primaryPressed: oxblood.pressed,
  primaryWash: oxblood.washLight,
  onPrimary: '#FFFFFF',
  destructive: '#141413', // ink; red is never spent on delete
  onDestructive: '#FAF9F5',
} as const;

export const darkColors = {
  deep: '#1F1E1D',
  bg: '#262624',
  surface: '#30302E',
  raised: '#3A3A37',
  secondary: '#3A3A37',
  muted: '#30302E',
  border: '#413F3C',
  input: '#55534E',
  text: '#F5F4EE',
  textMuted: '#A8A59D',
  textFaint: '#7C7A73',
  primary: oxblood.fillDark,
  primaryPressed: oxblood.pressedDark,
  primaryWash: oxblood.washDark,
  onPrimary: '#FFFFFF',
  destructive: '#F5F4EE',
  onDestructive: '#262624',
} as const;

export type SchemeColors = { [K in keyof typeof lightColors]: string };

/** Machine surfaces (scenes, room feeds, agent output): umber default. */
export const machineUmber = {
  ground: '#1C1C20',
  mid: '#222226',
  raise: '#2A2A30',
  line: '#35353C',
  text: '#D8D6DC',
  muted: '#88868E',
} as const;

/** User-themeable alternate machine surface (deep teal). */
export const machineDeepTeal = {
  ground: '#22434C',
  mid: '#284C56',
  raise: '#2F5661',
  line: '#3A6570',
  text: '#D8E2E4',
  muted: '#8FA6AB',
} as const;

export type MachineColors = { [K in keyof typeof machineUmber]: string };

/** Secondary hue + signal family (shared across schemes). */
export const accents = {
  teal: '#2D5F6B',
  tealLight: '#3A7A88',
  gold: '#C49A4A',
  goldLight: '#E0BC60', // loader glow / machine signal
  green: '#5A7A4A',
  purple: '#8B6FA0',
  blue: '#4A7A9A',
  pink: '#B06080',
  steel: '#6B7A8A',
  burntOrange: '#A65324', // machine pencil accent (web parity); NOT the primary
} as const;

/** Object-kind colors (web --cp-type-* parity). */
export const kindColors: Record<string, string> = {
  note: '#68666E',
  source: '#2D5F6B',
  link: '#2D5F6B',
  person: '#7A2733',
  place: '#C49A4A',
  organization: '#5A7A4A',
  concept: '#8B6FA0',
  quote: '#C49A4A',
  hunch: '#B06080',
  script: '#6B7A8A',
  task: '#C47A3A',
  epic: '#C47A3A',
  file: '#6B7A8A',
  image: '#8B6FA0',
  doc: '#4A7A9A',
  audio: '#B06080',
  sticky: '#C49A4A',
};

/** 4px base spacing scale (web --cp-space-* parity). */
export const space = {
  0: 0,
  px: 1,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  fab: 28,
  pill: 999,
} as const;

/** Type scale. Display = Bricolage Grotesque; UI = system; mono = platform mono. */
export const type = {
  display1: { fontSize: 28, lineHeight: 34, fontFamily: 'BricolageGrotesque_600SemiBold' },
  display2: { fontSize: 22, lineHeight: 28, fontFamily: 'BricolageGrotesque_600SemiBold' },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24 },
  sub: { fontSize: 15, lineHeight: 20 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 12, lineHeight: 16 },
} as const;

export const MAX_FONT_SIZE_MULTIPLIER = 1.4;

export const motion = {
  fast: 100,
  base: 150,
  slow: 250,
  // web --cp-spring-ease / --cp-ease-out parity
  springEase: [0.34, 1.56, 0.64, 1] as const,
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;

/** The single contact shadow (light mode only; dark mode elevates by tone). */
export const contactShadow = '0 1px 2px rgba(20, 20, 19, 0.07), 0 4px 14px rgba(20, 20, 19, 0.05)';

export const layout = {
  fabSize: 56,
  tabPillHeight: 56,
  topbarHeight: 52,
  touchTargetMin: 44,
} as const;
