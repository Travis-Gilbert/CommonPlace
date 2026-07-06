'use client';

/* Operator surface, V2 presentation (SPEC-OPERATOR-SURFACE-V2). A monitoring
 * screen with a triage strip, not a Kanban board: one glance answers who needs
 * me, what is moving, what is stuck — everything else lives behind a click.
 *
 * Zones: breadcrumb rail (no page title), attention strip (absent at zero),
 * the bays as hero cards, the compact Next queue, and the Icebox/Done
 * disclosures. The gate opens as a drawer from the rail badge; every task
 * opens the Room Panel (spec / activity / chat). State comes only from the
 * substrate via GET /api/theorem/operator; typed POST actions return
 * structured results. Fixture honesty is one dev-mode dot — no badges. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApiData } from '@/lib/commonplace-api';
import { fetchOperatorState, postOperatorAction } from '@/lib/theorem-operator-client';
import type { HeadId, OperatorAction, RegisteredHead, SessionBootstrap } from '@/lib/theorem-operator';
import { bayUrgency, isBlocked } from '@/lib/theorem-operator';
import { AttentionStrip } from './AttentionStrip';
import { BayCard } from './BayCard';
import { Queue } from './Queue';
import { RoomPanel } from './RoomPanel';
import { GateDrawer } from './GateDrawer';
import { BootstrapDialog } from './Bootstrap';
import { DevModeDot } from './parts';
import styles from './operator.module.css';

export default function OperatorPage() {
  const { data, loading, error, refetch } = useApiData(() => fetchOperatorState(), []);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [bootstrap, setBootstrap] = useState<SessionBootstrap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const baysRef = useRef<HTMLElement>(null);

  // Deep link from the Index: /v2/operator?room=<taskId> opens the Room Panel.
  // The Operator page is the aggregate view; the panel is the unit view.
  const roomApplied = useRef(false);
  useEffect(() => {
    if (roomApplied.current || !data) return;
    const room = new URLSearchParams(window.location.search).get('room');
    if (room && data.tasks.some((t) => t.id === room)) setOpenTaskId(room);
    roomApplied.current = true;
  }, [data]);

  const emptyBays: RegisteredHead[] = useMemo(() => {
    if (!data) return [];
    return data.bays.filter((b) => !b.task).map((b) => ({ id: b.head, label: b.label }));
  }, [data]);

  const urgentFromHeads = useMemo(
    () => new Set<string>((data?.shiftSummary.urgentMessages ?? []).map((m) => m.from)),
    [data],
  );

  const counts = useMemo(
    () => ({
      awaitingYou: data?.shiftSummary.urgentMessages.length ?? 0,
      blocked: (data?.tasks ?? []).filter((t) => (t.lane === 'now' || t.lane === 'next') && isBlocked(t)).length,
      newAtGate: data?.gate.length ?? 0,
    }),
    [data],
  );

  const runAction = useCallback(
    async (action: OperatorAction, key: string): Promise<boolean> => {
      setBusy(key);
      try {
        const result = await postOperatorAction(action);
        if (result.ok) {
          toast.success(result.message);
          if (result.bootstrap) {
            setBootstrap(result.bootstrap);
            setOpenTaskId(null); // close the panel so the bootstrap reads clean
          }
        } else {
          toast.error(result.message);
        }
        if (action.action !== 'reorder_queue' && action.action !== 'send_room_message') refetch();
        return result.ok;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refetch],
  );

  const openTask = openTaskId ? (data?.tasks.find((t) => t.id === openTaskId) ?? null) : null;
  const openRun = openTaskId ? (data?.drawers[openTaskId] ?? null) : null;

  return (
    <>
      <div className={styles.col}>
        {/* Row 1 — breadcrumb rail. No page title, no description sentence. */}
        <div className={styles.crumbRail}>
          <span className={styles.crumb}>Harness / Operator</span>
          <div className={styles.crumbAside}>
            <button className={styles.gateBadge} onClick={() => setGateOpen(true)} title="Open the gate">
              Gate
              <span className={styles.gateBadgeCount} data-zero={counts.newAtGate === 0 || undefined}>
                {counts.newAtGate}
              </span>
            </button>
            {data && <DevModeDot mode={data.source.mode} />}
            <button className={styles.refresh} onClick={() => refetch()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className={styles.errorCard}>Operator surface unavailable: {error.message}</div>}
        {loading && !data && <div className={styles.loading}>Loading the board…</div>}

        {data && (
          <>
            {/* Row 2 — attention strip (absent at zero; the bays rise). */}
            <AttentionStrip
              counts={counts}
              onAwaiting={() => baysRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onBlocked={() => setBlockedOnly((v) => !v)}
              onGate={() => setGateOpen(true)}
            />

            {/* Row 3 — the bays, the hero. Left-aligned, never stretched. */}
            <section ref={baysRef} className={styles.bayStrip} aria-label="Bays">
              {data.bays.map((bay) => (
                <BayCard
                  key={bay.head}
                  bay={bay}
                  urgency={bayUrgency(bay, urgentFromHeads)}
                  onOpenRoom={setOpenTaskId}
                />
              ))}
            </section>

            {/* Rows 4 + 5 — Next queue, Icebox, Done. */}
            <Queue
              tasks={data.tasks}
              onOpen={setOpenTaskId}
              blockedOnly={blockedOnly}
              onReorder={(taskId, priority) =>
                runAction({ action: 'reorder_queue', taskId, priority }, `reorder:${taskId}`)
              }
            />
          </>
        )}
      </div>

      <RoomPanel
        task={openTask}
        run={openRun}
        bays={data?.bays ?? []}
        emptyBays={emptyBays}
        open={!!openTask}
        onClose={() => setOpenTaskId(null)}
        onSend={(taskId, head) => runAction({ action: 'send_to_bay', taskId, head }, `send:${taskId}`)}
        onRefresh={(taskId) => runAction({ action: 'refresh_drawer', taskId }, `drawer:${taskId}`)}
        onSendMessage={(taskId, text, mention?: HeadId) =>
          runAction({ action: 'send_room_message', taskId, text, mention }, `msg:${taskId}`)
        }
        busy={busy?.startsWith('drawer:') || busy?.startsWith('msg:') || false}
      />
      <GateDrawer
        cards={data?.gate ?? []}
        busy={busy}
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onPass={(taskId) => runAction({ action: 'gate_pass', taskId }, `gate:${taskId}`)}
        onBounce={(taskId, requiredChanges) =>
          runAction({ action: 'gate_bounce', taskId, requiredChanges }, `gate:${taskId}`)
        }
      />
      <BootstrapDialog bootstrap={bootstrap} onClose={() => setBootstrap(null)} />
    </>
  );
}
