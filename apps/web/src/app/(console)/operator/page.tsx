'use client';

/* Operator surface, V2 presentation (SPEC-OPERATOR-SURFACE-V2 + OBJECT-CONTRACT-V2
 * OC5). A monitoring screen with a triage strip, not a Kanban board: one glance
 * answers who needs me, what is moving, what is stuck: everything else lives
 * behind a click.
 *
 * The arrangement (attention strip, bays, queue) is no longer hand-composed
 * here: it is a surface object rendered through <SurfaceRenderer> over an
 * OperatorBlockHost. Switching "Layout" swaps a second surface object (queue
 * left, bays as a table right) with zero code change: the proof that layouts
 * are data. The rail, Room Panel, Gate drawer, and Bootstrap stay as the page
 * shell around the interpreted surface. State comes only from the substrate via
 * GET /api/theorem/operator; typed POST actions return structured results. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import SurfaceRenderer from '@/components/commonplace/surface/SurfaceRenderer';
import { useApiData } from '@/lib/commonplace-api';
import { fetchOperatorState, postOperatorAction } from '@/lib/theorem-operator-client';
import type { HeadId, OperatorAction, RegisteredHead, SessionBootstrap } from '@/lib/theorem-operator';
import { isBlocked } from '@/lib/theorem-operator';
import { RoomPanel } from './RoomPanel';
import { GateDrawer } from './GateDrawer';
import { BootstrapDialog } from './Bootstrap';
import { LibraryPanel } from './LibraryPanel';
import { DevModeDot } from './parts';
import { OperatorBlockHost, type OperatorCallbacks } from './surface/OperatorBlockHost';
import { buildOperatorSurface, operatorSurfaceId, type OperatorLayout } from './surface/operator-surface';
import styles from './operator.module.css';

export default function OperatorPage() {
  const { data, loading, error, refetch } = useApiData(() => fetchOperatorState(), [], {
    cacheKey: 'v2:operator',
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [bootstrap, setBootstrap] = useState<SessionBootstrap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [layout, setLayout] = useState<OperatorLayout>('default');

  // The route resolves to a surface id: ?layout=alt renders the swap arrangement.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('layout') === 'alt') setLayout('alt');
  }, []);

  // Deep link from the Index: /operator?room=<taskId> opens the Room Panel.
  const [roomApplied, setRoomApplied] = useState(false);
  useEffect(() => {
    if (roomApplied || !data) return;
    const room = new URLSearchParams(window.location.search).get('room');
    if (room && data.tasks.some((t) => t.id === room)) setOpenTaskId(room);
    setRoomApplied(true);
  }, [data, roomApplied]);

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

  // Stable callbacks the operator view-instances reach through the host.
  const callbacks = useMemo<OperatorCallbacks>(
    () => ({
      openRoom: (taskId) => setOpenTaskId(taskId),
      reorder: (taskId, priority) => runAction({ action: 'reorder_queue', taskId, priority }, `reorder:${taskId}`),
      toggleBlockedOnly: () => setBlockedOnly((v) => !v),
      openGate: () => setGateOpen(true),
      scrollToBays: () =>
        document.querySelector('[data-op="bays"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    }),
    [runAction],
  );

  // The Operator arrangement as objects + the host that serves the live slices.
  const host = useMemo(
    () =>
      data
        ? new OperatorBlockHost(
            buildOperatorSurface(layout),
            counts,
            data.bays,
            data.tasks,
            urgentFromHeads,
            blockedOnly,
            callbacks,
          )
        : null,
    [data, layout, counts, urgentFromHeads, blockedOnly, callbacks],
  );

  const openTask = openTaskId ? (data?.tasks.find((t) => t.id === openTaskId) ?? null) : null;
  const openRun = openTaskId ? (data?.drawers[openTaskId] ?? null) : null;

  return (
    <>
      <div className={styles.col}>
        {/* Row 1: breadcrumb rail. CONVENTION: monitoring surfaces omit the
            p-top / p-h1 title block that content surfaces (account, settings,
            canvas) open with; the triage strip is the anchor, not a display
            heading. Deliberate divergence, not an oversight. */}
        <div className={styles.crumbRail}>
          <span className={styles.crumb}>Harness / Operator</span>
          <div className={styles.crumbAside}>
            <button
              className={styles.refresh}
              onClick={() => setLayout((l) => (l === 'alt' ? 'default' : 'alt'))}
              title="Swap the surface arrangement: same instances, different layout object"
            >
              Layout: {layout === 'alt' ? 'Split' : 'Stack'}
            </button>
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

        {/* Rows 2 to 5: the interpreted surface: attention strip, bays, queue. */}
        {host && <SurfaceRenderer surfaceId={operatorSurfaceId(layout)} host={host} chrome={false} />}
        <LibraryPanel />
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
