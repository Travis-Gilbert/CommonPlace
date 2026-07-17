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

export const metadata: Metadata = {
  title: 'CommonPlace Console',
  description: 'The harness console: IntelliJ chrome outside, the block-view object contract inside every pane.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-register="intui" className={fontVariableClasses}>
      <body>{children}</body>
    </html>
  );
}
