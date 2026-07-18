// SOURCING: next/font (IBM Plex Sans, Manrope, Vollkorn, JetBrains Mono, all
// OFL). next/font downloads at build time and serves from this origin, so no
// runtime font CDN request exists; this is the repo's established self-hosting
// convention (apps/web fonts.ts). The register bridge re-points --ij-font-ui /
// --ij-font-mono and the speaker --cp-font-* tokens at these variables.
//
// The console typography system (owner direction, 2026-07-18):
//   chrome + agent voice = IBM Plex Sans   (--font-console-plex)
//   human authorship      = Manrope ~200    (--font-console-manrope)
//   titles                = Vollkorn        (--font-console-vollkorn)
//   metadata / machinery  = JetBrains Mono  (--font-console-jbmono)
import { IBM_Plex_Sans, JetBrains_Mono, Manrope, Vollkorn } from 'next/font/google';

// Chrome and agent voice share IBM Plex Sans: the chrome grammar and the agent
// speaker read in the same face, and authorship still reads by face because
// human (Manrope) and titles (Vollkorn) are held distinct.
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
// body (Vollkorn, harder to read in paragraph form, moves to titles). Loaded as
// its variable font so the human weight (~200, extra light) is a CSS choice.
export const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-console-manrope',
  display: 'swap',
});

// Title face: Vollkorn, the Galley prose serif, now reserved for titles.
export const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-console-vollkorn',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const fontVariableClasses = [
  ibmPlexSans.variable,
  jetBrainsMono.variable,
  manrope.variable,
  vollkorn.variable,
].join(' ');
