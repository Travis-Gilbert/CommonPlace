// SOURCING: none. Pure logic, no upstream component applies.
import { ForkThemeBridge } from '@/components/fork-theme-bridge';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { fontVariableClasses } from './fonts';
// The generated Galley register loads as its own global sheet: the Tailwind
// entry pipeline drops this generated file when nested as a CSS @import
// (observed with Turbopack + Tailwind v4), so the layout owns the import.
// Order matters: the register loads first so the gy-bridge inside app.css
// wins the cascade and re-points Galley's planes at the chrome.
import '../styles/galley-register.css';
import '../styles/app.css';

// The bootstrap sets root data attributes before hydration so the register
// paints the right theme on first frame. It sets attributes ONLY.
//
// It used to also replay a derived theme's generated variables back onto the
// root as inline styles (the navy/paper "derived coloration" path). Inline
// styles outrank every stylesheet rule, so a stored derived theme silently
// overrode --ij-frame and the entire --ij-gray ramp on every load, on every
// deploy, forever: register changes appeared to have no effect, and the
// override followed the browser rather than the code. Derived coloration is
// retired (2026-08-01) and this script never writes inline paint again.
// A stored 'navy' or 'paper' family now fails validation and falls back to
// the IntelliJ family, which is the migration for anyone still carrying one.
const appearanceBootstrap = `(() => {
  const key = 'commonplace.console.appearance.v2';
  const legacy = 'commonplace.console.appearance.v1';
  const root = document.documentElement;
  let saved = null;
  // persistence-preference: key=commonplace.console.appearance.v2,commonplace.console.appearance.v1; preference=theme; reason=paints the chosen theme before hydration with a legacy fallback
  try { saved = JSON.parse(localStorage.getItem(key) || localStorage.getItem(legacy) || 'null'); } catch {}
  const candidate = saved?.preference;
  const validMode = ['auto', 'dark', 'light'].includes(candidate?.mode);
  const validFamily = ['intellij', 'github'].includes(candidate?.family);
  const preference = validMode && validFamily
    ? candidate
    : { mode: 'auto', family: 'intellij' };
  const mode = preference.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference.mode;
  root.dataset.theme = mode;
  root.dataset.themeMode = preference.mode;
  root.dataset.themeFamily = preference.family;
  root.dataset.themePreset = preference.family + '-' + mode;
  root.dataset.themeDerived = 'false';
})();`;

export const metadata: Metadata = {
  title: 'CommonPlace Console',
  description: 'The harness console: IntelliJ chrome outside, the block-view object contract inside every pane.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-register="intui"
      data-theme="dark"
      data-theme-mode="auto"
      data-theme-family="intellij"
      data-theme-preset="intellij-dark"
      data-theme-derived="false"
      suppressHydrationWarning
      className={fontVariableClasses}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
        <ForkThemeBridge>{children}</ForkThemeBridge>
      </body>
    </html>
  );
}
