// SOURCING: next/font (Inter, JetBrains Mono, Vollkorn, IBM Plex Sans, all OFL).
// next/font downloads at build time and serves from this origin, so no runtime
// font CDN request exists; this is the repo's established self-hosting
// convention (apps/web fonts.ts). The register bridge re-points --ij-font-ui /
// --ij-font-mono and the speaker --cp-font-* tokens at these variables.
import { Inter, JetBrains_Mono, Vollkorn, IBM_Plex_Sans } from 'next/font/google';

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-console-inter',
  display: 'swap',
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-console-jbmono',
  display: 'swap',
});

// Galley's own prose face (documents read like documents inside the IDE);
// self-hosted through the same pipeline so no runtime font CDN exists.
export const vollkorn = Vollkorn({
  subsets: ['latin'],
  variable: '--font-console-vollkorn',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

// Agent voice face (speaker register, AMENDMENT-REGISTERS-AND-MOBILE-
// RECONCILIATION 2.3): the agent speaks in IBM Plex Sans, held distinct from the
// chrome Inter and the human Vollkorn so a message's speaker reads by face
// alone. Galley names this face but ships no @font-face, and gy-bridge re-points
// its --gy-font-ui at the chrome Inter, so the console self-hosts Plex here and
// --cp-font-agent points at --font-console-plex.
export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-console-plex',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const fontVariableClasses = [
  inter.variable,
  jetBrainsMono.variable,
  vollkorn.variable,
  ibmPlexSans.variable,
].join(' ');
