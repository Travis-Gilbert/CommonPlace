'use client';

/**
 * CoBrowserView (HANDOFF-COBROWSE-PRESENCE): the product co-browse surface.
 * A shared browsing surface where the agent is a visible participant: control
 * spectrum (D2), telegraph intent line (D3), interrupt-to-pause chip (D4),
 * approval card (D5), receipt rail (D6), perception cards (D7), Keep with a
 * gold-register confirmation (D8), and the Presence mark as the telegraph
 * indicator. The page stage renders in the shell's tab windows; this panel is
 * the chrome. Raw JSON never renders here.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { hasData } from '@/lib/commonplace-view-state';
import { DesktopOnly, panel } from './desktopPanel';
import { ControlSpectrum } from '../cobrowse/ControlSpectrum';
import { ApprovalCard } from '../cobrowse/ApprovalCard';
import { ReceiptRail } from '../cobrowse/ReceiptRail';
import { PerceptionCards } from '../cobrowse/PerceptionCards';
import { KeepToast } from '../cobrowse/KeepToast';
import { useCoBrowseSession } from '../cobrowse/useCoBrowseSession';
import PresenceMark from '../presence/PresenceMark';
import type { PresenceState } from '../presence/presenceStates';
import { CarryAffordance } from '../carry/CarryAffordance';
import { SessionRail } from '../rail/SessionRail';
import { useCarry } from '@/lib/carry/useCarry';
import styles from '../cobrowse/cobrowse.module.css';

const ACTING_HOLD_MS = 900;

export default function CoBrowserView() {
  const session = useCoBrowseSession();
  const [url, setUrl] = useState('https://');
  const [task, setTask] = useState('');
  const [actingUntil, setActingUntil] = useState(0);
  const lastActionCount = useRef(0);

  // A new action entry in the rail means a commit just landed: hold the mark's
  // acting state (with its oxblood flash) briefly, then fall back.
  const actionCount = session.entries.filter((entry) => entry.kind === 'action').length;
  useEffect(() => {
    if (actionCount > lastActionCount.current) {
      lastActionCount.current = actionCount;
      setActingUntil(Date.now() + ACTING_HOLD_MS);
      const timer = setTimeout(() => setActingUntil(0), ACTING_HOLD_MS);
      return () => clearTimeout(timer);
    }
    lastActionCount.current = actionCount;
  }, [actionCount]);

  const markState: PresenceState = useMemo(() => {
    if (session.paused) return 'interrupted';
    if (actingUntil > 0) return 'acting';
    if (session.approval || session.telegraphIntent) return 'telegraphing';
    if (session.perception.status === 'loading') return 'thinking';
    if (session.running) return 'moving';
    return 'idle';
  }, [session.paused, session.approval, session.telegraphIntent, session.perception.status, session.running, actingUntil]);

  const perceptionData = hasData(session.perception) ? session.perception.data : null;

  // Carry the accumulated bundle into Write, Build, or Research (HANDOFF-CARRY).
  const { carry, busy: carryBusy } = useCarry(session.sessionId);

  return (
    <DesktopOnly>
      <div style={{ ...panel.wrap, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={panel.title}>Co-browser</div>
        <div style={panel.sub}>
          Browse alongside the agent. Pages render in the shell stage; the agent telegraphs
          before it acts, and everything it does lands in the receipts rail.
        </div>

        <div className={styles.chrome}>
          <PresenceMark state={markState} size={40} label="Co-browse agent" />
          <input
            className={styles.urlInput}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && task.trim()) void session.begin(url.trim(), task.trim());
            }}
            placeholder="https://example.com"
            aria-label="Page address"
          />
          <ControlSpectrum mode={session.mode} onChange={session.setMode} />
          <button
            style={panel.button}
            onPointerDown={() => void session.keep()}
            disabled={!session.tabId}
          >
            Keep
          </button>
          <CarryAffordance sessionId={session.sessionId} onCarry={carry} busy={carryBusy} />
        </div>

        <div className={styles.chrome}>
          <input
            className={styles.urlInput}
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && task.trim()) void session.begin(url.trim(), task.trim());
            }}
            placeholder="what should we do on this page?"
            aria-label="Task for the agent"
          />
          <button
            style={panel.button}
            onPointerDown={() => {
              if (task.trim()) void session.begin(url.trim(), task.trim());
            }}
          >
            Browse together
          </button>
        </div>

        {session.telegraphIntent && !session.approval ? (
          <div className={styles.intentLine} role="status">
            <PresenceMark state="telegraphing" size={22} label="Telegraph" />
            <span>{session.telegraphIntent}</span>
          </div>
        ) : null}

        {session.paused ? (
          <div className={styles.pauseChip} role="status">
            <span>Paused, you have the wheel</span>
            <button
              type="button"
              className={styles.resumeButton}
              onPointerDown={session.resume}
            >
              Resume
            </button>
          </div>
        ) : null}

        {session.approval ? (
          <ApprovalCard
            proposal={session.approval}
            perception={perceptionData}
            onApprove={() => void session.approve()}
            onDecline={() => void session.decline()}
          />
        ) : null}

        <PerceptionCards
          state={session.perception}
          onRunSuggested={() => void session.runSuggested()}
        />

        <ReceiptRail entries={session.entries} />
        <SessionRail sessionId={session.sessionId} title="Carry" />

        {session.error ? (
          <div style={{ ...panel.card, color: 'var(--cp-oxblood, crimson)' }}>{session.error}</div>
        ) : null}

        {session.keepReceipt ? (
          <KeepToast receipt={session.keepReceipt} onDismiss={session.dismissKeep} />
        ) : null}
      </div>
    </DesktopOnly>
  );
}
