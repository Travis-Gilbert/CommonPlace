'use client';

/* Operator surface (/v2, porcelain). The front-end of the operating protocol:
 * specs materialize as queue rows, heads occupy bays, receipts stream into a
 * drawer, and the human's two rituals — the morning scan and the evening gate —
 * are each one screen.
 *
 * HANDOFF-OPERATOR-SURFACE: OP2 queue + bays, OP3 assign + bootstrap, OP4 run
 * drawer, OP5 the gate, OP6 the shift summary. A porcelain sibling to the
 * Workroom Control Center. State comes only from the substrate via a single GET
 * to /api/theorem/operator; typed POST actions return structured results and
 * degrade honestly via source.mode until the backend lane swaps fixtures for live.
 *
 * Invariants: the queue renders substrate state only (no UI-local task store);
 * WIP is structural (occupied bays refuse assignment); the gate never passes
 * without rendered evidence; game vocabulary stays out (enterprise skin). */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as Tabs from '@radix-ui/react-tabs';
import { useApiData } from '@/lib/commonplace-api';
import { fetchOperatorState, postOperatorAction } from '@/lib/theorem-operator-client';
import type { OperatorAction, RegisteredHead, SessionBootstrap } from '@/lib/theorem-operator';
import { ShiftSummary } from './ShiftSummary';
import { Bays } from './Bays';
import { Queue } from './Queue';
import { RunDrawer } from './RunDrawer';
import { Gate } from './Gate';
import { BootstrapDialog } from './Bootstrap';
import { SourceBadge } from './parts';
import styles from './operator.module.css';

type OperatorTab = 'board' | 'gate';

export default function OperatorPage() {
  const { data, loading, error, refetch } = useApiData(() => fetchOperatorState(), []);
  const [tab, setTab] = useState<OperatorTab>('board');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<SessionBootstrap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const emptyBays: RegisteredHead[] = useMemo(() => {
    if (!data) return [];
    return data.bays.filter((b) => !b.task).map((b) => ({ id: b.head, label: b.label }));
  }, [data]);

  const runAction = useCallback(
    async (action: OperatorAction, key: string) => {
      setBusy(key);
      try {
        const result = await postOperatorAction(action);
        if (result.ok) {
          toast.success(result.message);
          if (result.bootstrap) setBootstrap(result.bootstrap);
        } else {
          toast.error(result.message);
        }
        // Reflect substrate state after mutating actions. Reorder is optimistic
        // and locally held (fixtures return a fixed priority), so it does not refetch.
        if (action.action !== 'reorder_queue') refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [refetch],
  );

  const openDrawer = openTaskId ? (data?.drawers[openTaskId] ?? null) : null;
  const reviewCount = data?.gate.length ?? 0;

  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Harness / Operator</div>
          <h1 className="p-h1">Operator</h1>
          <div className="p-orient">
            The board is the substrate: specs become tasks, heads occupy bays, receipts stream, the gate decides.
          </div>
        </div>
        <div className={styles.headerAside}>
          <span className={`${styles.mono} ${styles.dim}`}>{data?.targetSurface ?? 'app.theoremharness.com'}</span>
          {data && <SourceBadge source={data.source} />}
          <button className={styles.refresh} onClick={() => refetch()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as OperatorTab)} className={styles.tabsRoot}>
        <Tabs.List className={styles.tabs} aria-label="Operator views">
          <Tabs.Trigger value="board" className={styles.tab}>
            Board
          </Tabs.Trigger>
          <Tabs.Trigger value="gate" className={styles.tab}>
            Gate
            {reviewCount ? <span className={styles.tabCount}>{reviewCount}</span> : null}
          </Tabs.Trigger>
        </Tabs.List>

        <div className={styles.body}>
          {error && <div className={styles.errorCard}>Operator surface unavailable: {error.message}</div>}
          {loading && !data && <div className={styles.loading}>Loading the board…</div>}
          {data && (
            <>
              <Tabs.Content value="board" className={styles.tabPanel}>
                <ShiftSummary
                  summary={data.shiftSummary}
                  onOpenTask={setOpenTaskId}
                  onGoGate={() => setTab('gate')}
                />
                <Bays bays={data.bays} onOpen={setOpenTaskId} />
                <Queue
                  tasks={data.tasks}
                  emptyBays={emptyBays}
                  onOpen={setOpenTaskId}
                  onSend={(taskId, head) => runAction({ action: 'send_to_bay', taskId, head }, `send:${taskId}`)}
                  onReorder={(taskId, priority) =>
                    runAction({ action: 'reorder_queue', taskId, priority }, `reorder:${taskId}`)
                  }
                />
              </Tabs.Content>
              <Tabs.Content value="gate" className={styles.tabPanel}>
                <Gate
                  cards={data.gate}
                  busy={busy}
                  onPass={(taskId) => runAction({ action: 'gate_pass', taskId }, `gate:${taskId}`)}
                  onBounce={(taskId, requiredChanges) =>
                    runAction({ action: 'gate_bounce', taskId, requiredChanges }, `gate:${taskId}`)
                  }
                />
              </Tabs.Content>
            </>
          )}
        </div>
      </Tabs.Root>

      <RunDrawer
        drawer={openDrawer}
        open={!!openDrawer}
        onClose={() => setOpenTaskId(null)}
        onRefresh={(taskId) => runAction({ action: 'refresh_drawer', taskId }, `drawer:${taskId}`)}
        busy={busy?.startsWith('drawer:') ?? false}
      />
      <BootstrapDialog bootstrap={bootstrap} onClose={() => setBootstrap(null)} />
    </>
  );
}
