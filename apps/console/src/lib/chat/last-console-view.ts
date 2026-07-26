// SOURCING: none. Pure logic. Chat mode switcher returns here (CH3).

export const LAST_CONSOLE_VIEW_KEY = 'commonplace.console.last-view.v1';

export function readLastConsoleViewPath(): string {
  if (typeof window === 'undefined') return '/v/workspace';
  try {
    const raw = window.localStorage.getItem(LAST_CONSOLE_VIEW_KEY);
    if (raw && raw.startsWith('/')) return raw;
  } catch {
    // Storage may be unavailable.
  }
  return '/v/workspace';
}

export function writeLastConsoleViewPath(path: string): void {
  if (typeof window === 'undefined') return;
  if (!path.startsWith('/') || path.startsWith('/chat')) return;
  try {
    window.localStorage.setItem(LAST_CONSOLE_VIEW_KEY, path);
  } catch {
    // Best-effort.
  }
}
