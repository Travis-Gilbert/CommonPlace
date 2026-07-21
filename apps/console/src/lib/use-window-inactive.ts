'use client';

// SOURCING: none. Window focus → inactiveAlpha overlay (HANDOFF-CONSOLE-ISLAND-SHELL).

import { useEffect } from 'react';

/** Sets `data-window-inactive` on `<html>` when the window blurs. */
export function useWindowInactiveOverlay(): void {
  useEffect(() => {
    const root = document.documentElement;
    const setInactive = (inactive: boolean) => {
      if (inactive) root.setAttribute('data-window-inactive', 'true');
      else root.removeAttribute('data-window-inactive');
    };
    const onBlur = () => setInactive(true);
    const onFocus = () => setInactive(false);
    const onVisibility = () => setInactive(document.hidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    setInactive(document.hidden || !document.hasFocus());
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      root.removeAttribute('data-window-inactive');
    };
  }, []);
}
