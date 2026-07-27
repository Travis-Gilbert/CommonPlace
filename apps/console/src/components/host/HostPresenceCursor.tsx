// SOURCING: textmode.js (https://code.textmode.art/) via PresenceMark — React
// realm agent cursor from bridge presence events (SPEC F1). Visually continuous
// with native chrome: same Presence mark, live WebGL2 constellation when able.

'use client';

import { useEffect, useState } from 'react';
import type { HostLens, HostPresence } from '@commonplace/host-bridge';
import { PresenceMark } from '@/components/mark/PresenceMark';
import { useHost } from '@/lib/commonplace-host/HostProvider';
import { hostPresenceToMarkState } from '@/lib/commonplace-host/presenceMap';

export interface HostPresenceCursorProps {
  workspaceId?: string;
  /** Surface this React realm claims (presence for other surfaces is ignored). */
  surface?: string;
}

/**
 * Subscribes to bridge presence + lens events and paints the agent cursor
 * with textmode.js inside the console surface. Does not draw over native
 * chrome or Servo.
 */
export function HostPresenceCursor({
  workspaceId = 'default',
  surface = 'commonplace',
}: HostPresenceCursorProps) {
  const host = useHost();
  const [presence, setPresence] = useState<HostPresence | null>(null);
  const [lens, setLens] = useState<HostLens | null>(null);

  useEffect(() => {
    return host.subscribeWorkspace(workspaceId, (e) => {
      if (e.type === 'presence' && e.presence.surface === surface) {
        setPresence(e.presence);
      }
      if (e.type === 'lens' && e.lens.surface === surface) {
        setLens(e.lens);
      }
    });
  }, [host, workspaceId, surface]);

  if (!presence) return null;

  const markState = hostPresenceToMarkState(presence);
  const x = presence.anchor?.x ?? 24;
  const y = presence.anchor?.y ?? 24;

  return (
    <div
      aria-live="polite"
      aria-label={presence.intent ?? `Agent ${presence.state}`}
      data-host-presence={presence.state}
      data-host-frozen={presence.frozen ? '1' : '0'}
      data-host-lens-spans={lens?.spans.length ?? 0}
      data-textmode-cursor="1"
      className="pointer-events-none absolute z-20"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Live textmode.js stage (code.textmode.art) — not the composer chip. */}
      <PresenceMark state={markState} size={56} />
    </div>
  );
}
