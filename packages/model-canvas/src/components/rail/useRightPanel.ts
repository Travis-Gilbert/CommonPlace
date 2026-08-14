// SOURCING: OWOX/models useRightPanel (Apache-2.0). Share/enable/account panels removed.

import { useState, useCallback } from 'react';

export type RightPanelId = 'inspect' | 'models' | 'history';

/** No auth gate — registry history is always available in CommonPlace. */
export function gatedPanelId(id: RightPanelId, _signedIn = true): RightPanelId {
  return id;
}

export function useRightPanel() {
  const [active, setActive] = useState<RightPanelId | null>(null);
  const open = useCallback((id: RightPanelId) => setActive(id), []);
  const close = useCallback(() => setActive(null), []);
  return { active, open, close };
}
