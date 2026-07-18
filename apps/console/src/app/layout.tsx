// SOURCING: none. Pure logic, no upstream component applies.
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

const appearanceBootstrap = `(() => {
  const key = 'commonplace.console.appearance.v1';
  const root = document.documentElement;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  const candidate = saved?.preference;
  const validMode = ['auto', 'dark', 'light'].includes(candidate?.mode);
  const validFamily = ['intellij', 'github', 'navy'].includes(candidate?.family);
  const preference = validMode && validFamily
    ? candidate
    : { mode: 'auto', family: 'intellij' };
  const mode = preference.mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference.mode;
  const preset = preference.family === 'navy' ? 'navy' : preference.family + '-' + mode;
  root.dataset.theme = mode;
  root.dataset.themeMode = preference.mode;
  root.dataset.themeFamily = preference.family;
  root.dataset.themePreset = preset;
  root.dataset.themeDerived = preference.family === 'navy' ? 'true' : 'false';
  if (preference.family === 'navy' && saved?.resolvedMode === mode && saved?.variables) {
    for (const [name, value] of Object.entries(saved.variables)) root.style.setProperty(name, String(value));
  }
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
        {children}
      </body>
    </html>
  );
}
