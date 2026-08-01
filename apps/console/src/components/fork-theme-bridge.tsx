'use client';

// SOURCING: twenty-ui `ThemeProvider` (packages/twenty-ui/src/theme-constants,
// hard fork). SPEC-COMMONPLACE-TWENTY-UI-FORK-1.0 TU2.
//
// The fork's theme object is a map of `var(--t-*)` accessor strings, which is
// exactly right for the colors: components put them in inline styles and CSS
// resolves them, so the console's register drives the paint with no provider
// involved. The numeric slots are the exception. `theme.icon.size.md` reaches a
// Tabler icon as a `size` prop, and a `var(...)` string there renders nothing.
//
// ThemeProvider resolves those from computed style at mount. This bridge is the
// one place it is installed, bound to the console's own resolved mode so the
// `.dark` / `.light` classes it toggles agree with `data-theme` rather than
// fighting it.

import type { ReactNode } from 'react';
import { ThemeProvider } from 'twenty-ui/theme-constants';
import { useAppearance } from '@/lib/appearance-store';

export function ForkThemeBridge({ children }: { readonly children: ReactNode }) {
  const { resolvedMode } = useAppearance();

  return <ThemeProvider colorScheme={resolvedMode}>{children}</ThemeProvider>;
}
