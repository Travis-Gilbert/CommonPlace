'use client';

// The v2 shell: owns the main-rail collapsed state and renders the rail + main.
// Pattern is the shadcn Mail rail (collapse the app nav to icons, let a
// screen-specific secondary rail carry the local options). The rail
// auto-collapses on surfaces that bring their own secondary rail (Graph), and a
// manual toggle overrides until the next route change.

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Rail } from '@/components/v2/Rail';

interface V2ShellContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const V2ShellContext = createContext<V2ShellContextValue>({ collapsed: false, toggle: () => {} });

export function useV2Shell(): V2ShellContextValue {
  return useContext(V2ShellContext);
}

// Surfaces that ship their own secondary rail want the app rail collapsed.
const AUTO_COLLAPSE = ['/graph'];

// The user's deliberate collapse preference survives reloads; the graph
// force-collapse is transient and never written to it.
const PREF_KEY = 'v2-rail-collapsed';

function readCollapsePref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsePref(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREF_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable: preference is best-effort */
  }
}

const isForcedRoute = (pathname: string) => AUTO_COLLAPSE.some((prefix) => pathname.startsWith(prefix));

export function V2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Deterministic initial state on server + first client render (no localStorage
  // read here) so hydration matches; the stored preference is applied on mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(isForcedRoute(pathname) ? true : readCollapsePref());
  }, [pathname]);

  const toggle = () => {
    const forced = isForcedRoute(pathname);
    setCollapsed((c) => {
      const next = !c;
      // Persist only a deliberate toggle on a normal surface; expanding the graph
      // rail is a transient override, not a saved preference.
      if (!forced) writeCollapsePref(next);
      return next;
    });
  };

  return (
    <V2ShellContext.Provider value={{ collapsed, toggle }}>
      <Rail />
      {/* The content sheet: one lightness step up from the ground, rounded only
          at the sidebar seam. CR3 flip, in register utilities. */}
      <main className="flex min-h-dvh min-w-0 flex-1 flex-col rounded-l-cr-lg border-l border-cr-hairline bg-cr-surface">
        {children}
      </main>
    </V2ShellContext.Provider>
  );
}
