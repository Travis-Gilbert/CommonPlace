// SOURCING: next/font (Inter + JetBrains Mono, both OFL). next/font downloads
// at build time and serves from this origin, so no runtime font CDN request
// exists; this is the repo's established self-hosting convention (apps/web
// fonts.ts). The register bridge re-points --ij-font-ui / --ij-font-mono at
// these variables.
import { Inter, JetBrains_Mono, Vollkorn } from 'next/font/google';

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

export const fontVariableClasses = [inter.variable, jetBrainsMono.variable, vollkorn.variable].join(' ');
