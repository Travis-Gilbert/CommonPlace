'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useWorkThread } from '@/lib/work-surface/use-work-thread';
import type { WorkStage } from '@/lib/work-surface/omnibar';
import { WorkThread } from '@/components/v2/work/WorkThread';
import { WorkOmnibar } from '@/components/v2/work/WorkOmnibar';
import { WorkStageHost } from '@/components/v2/work/WorkStageHost';
import styles from '@/components/v2/work/work.module.css';

// Single-user session id: a real, stable per-browser id (localStorage-backed
// via useLocalYjs's IndexedDB naming), not a fabricated multi-user room.
const SESSION_ID = 'default';

export default function WorkPage() {
  const { messages, ask, runTool } = useWorkThread(SESSION_ID);
  const [stage, setStage] = useState<WorkStage | null>(null);

  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Harness / Work</div>
          <h1 className="p-h1">Work</h1>
        </div>
      </header>

      <div className={styles.route}>
        <PanelGroup direction="horizontal" autoSaveId="v2-work-panes" className={styles.group}>
          <Panel order={1} defaultSize={stage ? 55 : 100} minSize={35} className={styles.threadPanel}>
            <WorkThread messages={messages} />
            <WorkOmnibar onAsk={ask} onOpenStage={setStage} onRunTool={runTool} />
          </Panel>
          {stage && (
            <>
              <PanelResizeHandle className={styles.handle} aria-label="Resize the stage pane" />
              <Panel order={2} defaultSize={45} minSize={30} className={styles.stagePanel}>
                <WorkStageHost stage={stage} onClose={() => setStage(null)} />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </>
  );
}
