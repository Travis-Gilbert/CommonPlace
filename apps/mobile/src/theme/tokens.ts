/**
 * CommonPlace mobile tokens: the Int UI material ladder adapted to native
 * controls. The values match the Console register roles while navigation,
 * gestures, typography sizing, and safe-area behavior stay platform-native.
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
  deep: '#EBECF0',
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  secondary: '#EBECF0',
  muted: '#F7F8FA',
  border: '#D3D5DB',
  input: '#C9CCD6',
  text: '#27282E',
  textMuted: '#6C707E',
  textFaint: '#818594',
  primary: '#3574F0',
  primaryPressed: '#3369D6',
  primaryWash: '#D4E2FF',
  onPrimary: '#FFFFFF',
  destructive: '#AD2B38',
  onDestructive: '#FFFFFF',
} as const;

export const darkColors = {
  deep: '#131314',
  bg: '#1E1F22',
  surface: '#2B2D30',
  raised: '#393B40',
  secondary: '#393B40',
  muted: '#2B2D30',
  border: '#1E1F22',
  input: '#4E5157',
  text: '#DFE1E5',
  textMuted: '#868A91',
  textFaint: '#6F737A',
  primary: '#3574F0',
  primaryPressed: '#467FF2',
  primaryWash: '#2E436E',
  onPrimary: '#FFFFFF',
  destructive: '#DB5C5C',
  onDestructive: '#FFFFFF',
} as const;

export type SchemeColors = { [K in keyof typeof lightColors]: string };

/** Machine surfaces remain separate from speaker identity. */
export const machineUmber = {
  ground: '#1E1F22',
  mid: '#2B2D30',
  raise: '#393B40',
  line: '#43454A',
  text: '#DFE1E5',
  muted: '#868A91',
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
  tealLight: '#45B4A3',
  gold: '#9A6000',
  goldLight: '#D6AE58',
  green: '#57965C',
  purple: '#955AE0',
  blue: '#3574F0',
  pink: '#B06080',
  steel: '#6B7A8A',
  burntOrange: '#A65324', // machine pencil accent (web parity); NOT the primary
} as const;

/**
 * Speaker register: the cross-platform --cp-* roles (AMENDMENT-REGISTERS-AND-
 * MOBILE-RECONCILIATION section 2). Authorship encoding for conversational
 * content: chat messages, margin threads, annotations, approval and proposal
 * cards. The web home of the same roles is apps/console register-bridge.css
 * (--cp-human, --cp-agent, --cp-memory, --cp-destructive); this mirrors them by
 * role so both renderers speak one vocabulary.
 *
 * Roles carry verbatim from the spec; values re-resolve per scheme. Human ink is
 * the oxblood family (the same role at two lightnesses: deep on the light well,
 * lifted on the dark well, which is the "two values, one token" the amendment
 * names). Agent voice is teal. Memory is gold, darkened to read as text on the
 * light well. Destructive stays reserved: mobile spends ink on delete, never
 * red, so the human's oxblood voice never reads as danger.
 *
 * Contrast receipts (WCAG 2.x relative luminance, computed not eyeballed; text
 * target 4.5:1):
 *   The executable contrast gate resolves these roles against both scheme
 *   backgrounds; comments never substitute for the computed receipt.
 */
export const speaker = {
  light: {
    human: oxblood.fill, // #7A2733
    agent: accents.teal, // #2D5F6B
    memory: '#8A6D1F', // gold darkened for AA as text on the light well
    destructive: lightColors.destructive, // ink, never red
  },
  dark: {
    human: '#DE7C72', // oxblood lifted for AA as text on the dark well
    agent: '#45B4A3', // teal lifted for AA, held hue-distant from a blue accent
    memory: accents.goldLight, // #E0BC60
    destructive: darkColors.destructive, // ink, never red
  },
  /** Typography trinity: assigned by speaker on content surfaces (web parity). */
  fonts: {
    human: 'Vollkorn_400Regular', // human authorship
    agent: 'IBMPlexSans_400Regular', // agent voice
    machine: 'JetBrainsMono_400Regular', // machinery, regardless of speaker
  },
} as const;

export type SpeakerScheme = { [K in keyof typeof speaker.light]: string };

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

/** Int UI type scale. Chrome and controls stay Inter. */
export const type = {
  display1: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter_600SemiBold' },
  display2: { fontSize: 22, lineHeight: 28, fontFamily: 'Inter_600SemiBold' },
  headline: { fontSize: 17, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  body: { fontSize: 17, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  sub: { fontSize: 15, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium' },
} as const;

export const MAX_FONT_SIZE_MULTIPLIER = 1.4;

export const motion = {
  fast: 100,
  base: 150,
  slow: 250,
  // Motion scale (HANDOFF-MOTION-TOKENS): mirrors web --cp-dur-* / --cp-ease-* in
  // apps/web/src/styles/commonplace-tokens.css. Durations in ms. Press feedback fires
  // on pointer-down (onPressIn) as a state change; the rest tween.
  durPress: 90,
  durHover: 120,
  durLocal: 200,
  durPanel: 280,
  durMax: 400,
  // easeOut was redefined per the handoff. Old value: [0.16, 1, 0.3, 1].
  easeOut: [0.2, 0, 0, 1] as const,
  easeInOut: [0.45, 0, 0.55, 1] as const,
  easeExit: [0.3, 0, 1, 1] as const,
  // CSS proxy for spring-snappy (the real springs live in theme/springs.ts).
  springEase: [0.34, 1.56, 0.64, 1] as const,
  // Transform vocabulary: hover lifts, press compresses, entering rises then fades.
  hoverLift: -1,
  pressScale: 0.98,
  enterRise: 8,
} as const;

/** The single contact shadow (light mode only; dark mode elevates by tone). */
export const contactShadow = '0 1px 2px rgba(20, 20, 19, 0.07), 0 4px 14px rgba(20, 20, 19, 0.05)';

export const layout = {
  fabSize: 56,
  tabPillHeight: 56,
  topbarHeight: 52,
  touchTargetMin: 44,
} as const;
