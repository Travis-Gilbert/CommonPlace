'use client';

// Soft App Router navigation that resolves when the URL segment matches.
// Rail activate flips data-active-surface immediately; cold compiles can lag
// router.push. Callers that need the path settled await this helper.

function normalizePath(path: string): string {
  if (!path) return '/';
  const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function softNavigate(
  router: { push: (href: string) => void },
  path: string,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const target = normalizePath(path);
  if (normalizePath(window.location.pathname) === target) return;
  router.push(path);
  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  while (Date.now() < deadline) {
    if (normalizePath(window.location.pathname) === target) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (normalizePath(window.location.pathname) !== target) {
    throw new Error(`softNavigate timed out waiting for ${target} (at ${window.location.pathname})`);
  }
}
