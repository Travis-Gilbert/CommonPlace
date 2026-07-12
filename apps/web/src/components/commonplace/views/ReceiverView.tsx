'use client';

/**
 * ReceiverView (SPEC-9 D5): the local agent-execution panel. Shows receiver
 * state + detected lanes and toggles it on/off through the shell's Tauri
 * commands (receiver_status / receiver_settings_get / receiver_settings_set).
 */

import { useCallback, useState } from 'react';
import { useApiData } from '@/lib/commonplace-api';
import {
  receiverSettingsGet,
  receiverSettingsSet,
  receiverStatus,
} from '@/lib/desktop';
import { DesktopOnly, panel } from './desktopPanel';
import PresenceMark from '../presence/PresenceMark';
import type { PresenceState } from '../presence/presenceStates';

export default function ReceiverView() {
  const { data: status, error, refetch } = useApiData(() => receiverStatus(), []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = useCallback(async () => {
    setBusy(true);
    try {
      const settings = await receiverSettingsGet();
      await receiverSettingsSet({ ...settings, enabled: !settings.enabled });
      setActionError(null);
      refetch();
    } catch (err) {
      setActionError(String(err));
    } finally {
      setBusy(false);
    }
  }, [refetch]);

  const errorMessage = actionError ?? error?.message ?? null;

  // Run-activity glyph (SPEC-UI-SOURCING-ADDENDUM Presence D2): the same
  // Presence mark as the co-browse telegraph and the chat composing indicator.
  const markState: PresenceState = !status
    ? 'thinking'
    : !status.enabled
      ? 'interrupted'
      : status.state === 'idle'
        ? 'idle'
        : 'moving';

  return (
    <DesktopOnly>
      <div style={panel.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PresenceMark state={markState} size={28} label="Receiver activity" />
          <div style={panel.title}>Receiver</div>
        </div>
        <div style={panel.sub}>
          Local agent execution. Claims jobs and spawns the installed claude / codex CLI in a
          mapped worktree.
        </div>
        {errorMessage && <div style={{ ...panel.card, color: 'crimson' }}>{errorMessage}</div>}
        <div style={panel.card}>
          <div style={panel.row}>
            <strong>Status:</strong>
            <span>{status ? status.state : 'loading...'}</span>
            <span style={{ flex: 1 }} />
            <button
              style={panel.button}
              onClick={() => void toggle()}
              disabled={busy || !status}
            >
              {status?.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>
          <div style={panel.dim}>
            Lanes: {status?.lanes.length ? status.lanes.join(', ') : 'none detected'}
          </div>
          {status?.lastClaimTime && (
            <div style={panel.dim}>Last claim: {status.lastClaimTime}</div>
          )}
          {status?.lastJobResult && (
            <div style={panel.dim}>Last result: {status.lastJobResult}</div>
          )}
        </div>
      </div>
    </DesktopOnly>
  );
}
