// SOURCING: next/font (IBM Plex Sans, Manrope, JetBrains Mono, all OFL).
// next/font downloads at build time and serves from this origin, so no
// runtime font CDN request exists; this is the repo's established self-hosting
// convention (apps/web fonts.ts). The register bridge re-points --ij-font-ui /
// --ij-font-mono and the speaker --cp-font-* tokens at these variables.
//
// The console typography system (owner direction, 2026-07-29 serif wipe):
//   chrome + agent voice + titles = IBM Plex Sans  (--font-console-plex)
//   human authorship              = Manrope ~200   (--font-console-manrope)
//   metadata / machinery          = JetBrains Mono (--font-console-jbmono)
// Vollkorn is retired: titles carry the chrome face at a heavier weight, and
// Galley prose bridges to Manrope (gy-bridge.css). The title slot stays a
// token (--cp-font-title) so a future display face lands as a one-line change.
import { IBM_Plex_Sans, JetBrains_Mono, Manrope } from 'next/font/google';

// Chrome, titles, and the agent voice share IBM Plex Sans: one face for the
// machine's grammar, weight-differentiated for titles. Authorship still reads
// by face because human (Manrope) is held distinct.
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-console-plex',
  display: 'swap',
  weight: ['400', '500', '600'],
});

// Metadata and machinery face, any speaker.
export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-console-jbmono',
  display: 'swap',
});

// Human authorship face: Manrope, a light geometric sans that reads easily as
// body. Loaded as its variable font so the human weight (~200, extra light)
// is a CSS choice.
export const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-console-manrope',
  display: 'swap',
});

export const fontVariableClasses = [
  ibmPlexSans.variable,
  jetBrainsMono.variable,
  manrope.variable,
].join(' ');
