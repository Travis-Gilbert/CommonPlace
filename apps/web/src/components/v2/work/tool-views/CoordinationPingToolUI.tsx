'use client';

import type { WorkToolPart } from '@/lib/work-surface/types';
import { readRoomContext, readErrorResult } from '@/lib/work-surface/tool-result-readers';
import styles from '../work.module.css';

/**
 * WS3 bespoke tool view for the omnibar's /ping command. Renders the
 * already-fetched Tauri room_context result. In a plain browser tab (no
 * Tauri runtime), use-work-thread.ts's runTool never calls room_context at
 * all and settles this part with an honest "unavailable" error instead of
 * fabricating room data.
 */
export function CoordinationPingToolUI({ part }: { part: WorkToolPart }) {
  if (part.status === 'running') {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Coordination ping</div>
        <div className={styles.toolLoading}>Checking the room&hellip;</div>
      </div>
    );
  }

  const errorMessage = readErrorResult(part.result);
  if (errorMessage) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Coordination ping</div>
        <div className={styles.toolEmpty}>{errorMessage}</div>
      </div>
    );
  }

  const summary = readRoomContext(part.result);
  if (!summary) {
    return (
      <div className={styles.toolCard}>
        <div className={styles.toolCardHead}>Coordination ping</div>
        <div className={styles.toolEmpty}>No room data.</div>
      </div>
    );
  }

  return (
    <div className={styles.toolCard}>
      <div className={styles.toolCardHead}>Coordination ping</div>
      <p className={styles.toolAnswer}>
        {summary.participants.length > 0
          ? `${summary.participants.join(', ')} in the room.`
          : 'No one else is in the room right now.'}
      </p>
      <p className={styles.toolMeta}>
        {summary.feedCount} feed message{summary.feedCount === 1 ? '' : 's'} &middot; {summary.intentCount} active
        intent{summary.intentCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
