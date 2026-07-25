// SOURCING: @commonplace/host-bridge + textmode.js (https://code.textmode.art/)
// — publishes canonical presence into the React realm so HostPresenceCursor's
// PresenceMark (textmode WebGL2 constellation) stays live (SPEC F1).

'use client';

import { useEffect, useRef } from 'react';
import { asHostEventPublisher } from '@commonplace/host-bridge';
import { useHost } from '@/lib/commonplace-host/HostProvider';
import { useThreadStore } from '@/lib/thread-store';

export interface HostPresenceSyncProps {
  workspaceId?: string;
  surface?: string;
}

/**
 * Bridges thread running state onto host presence events. Anchor follows the
 * last pointer position inside the shell so the textmode cursor feels attached
 * to the agent's work, not a fixed corner chip.
 */
export function HostPresenceSync({
  workspaceId = 'default',
  surface = 'commonplace',
}: HostPresenceSyncProps) {
  const host = useHost();
  const isRunning = useThreadStore((state) => state.isRunning);
  const anchorRef = useRef({ x: 48, y: 72 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      anchorRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    const shell = document.querySelector<HTMLElement>('[data-shell]');
    shell?.addEventListener('pointermove', onMove);
    return () => shell?.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    const publisher = asHostEventPublisher(host);
    if (!publisher) return;

    const publish = () => {
      publisher.publishPresence(workspaceId, {
        surface,
        state: isRunning ? 'acting' : 'idle',
        frozen: false,
        anchor: { ...anchorRef.current },
        intent: isRunning ? 'composing' : undefined,
      });
    };

    publish();
    if (!isRunning) return;
    const id = window.setInterval(publish, 120);
    return () => window.clearInterval(id);
  }, [host, isRunning, surface, workspaceId]);

  return null;
}
