// SOURCING: none — maps HostPresence bridge state onto console PresenceMark
// states (SPEC-COMMONPLACE-NATIVE-SHELL-1.0 F1).

import type { HostPresence } from '@commonplace/host-bridge';
import type { MarkState } from '@/components/mark/PresenceMark';

/** Map canonical host presence onto the console PresenceMark vocabulary. */
export function hostPresenceToMarkState(p: HostPresence): MarkState {
  if (p.frozen || p.state === 'frozen') return 'interrupted';
  switch (p.state) {
    case 'acting':
      return 'acting';
    case 'handoff':
      return 'composing';
    case 'idle':
    default:
      return 'idle';
  }
}
