// SOURCING: @playwright/test. Installs a one-shot storage reset before the
// application mounts, avoiding concurrent layout bootstrap during test setup.

import type { Page } from '@playwright/test';

const RESET_MARKER = 'commonplace.e2e.storage-reset.v1';

export async function resetLocalStorageBeforeNavigation(
  page: Page,
  options: {
    readonly keys: readonly string[];
    readonly prefixes?: readonly string[];
  },
): Promise<void> {
  await page.addInitScript(
    ({ keys, marker, prefixes }) => {
      if (sessionStorage.getItem(marker) === '1') return;
      for (const key of keys) localStorage.removeItem(key);
      for (const key of Object.keys(localStorage)) {
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.setItem(marker, '1');
    },
    {
      keys: [...options.keys],
      marker: RESET_MARKER,
      prefixes: [...(options.prefixes ?? [])],
    },
  );
}
