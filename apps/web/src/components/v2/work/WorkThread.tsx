'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getWorkBlockHost } from '@/lib/work-surface/work-block-host';
import { objectQueryForFocalIds, resolveToolViewKind } from '@/lib/work-surface/tool-view-kind';
import { useSpring, SETTLE_EXIT, FADE_EXIT } from '@/lib/work-surface/work-motion';
import type { WorkMessage, WorkToolPart } from '@/lib/work-surface/types';
import { CoordinationPingToolUI } from './tool-views/CoordinationPingToolUI';
import { MemoryRecallToolUI } from './tool-views/MemoryRecallToolUI';
import { ObjectSetToolUI } from './tool-views/ObjectSetToolUI';
import styles from './work.module.css';

/**
 * Thread pane. Deliberately not built on ThreadPrimitive/MessagePrimitive:
 * WS1's WorkMessage log already carries everything needed for a scannable
 * transcript (role, text, tool parts, streaming flag), and the omnibar below
 * is a separate persistent input rather than a per-thread ComposerPrimitive
 * footer, so the extra runtime-context plumbing isn't earning its keep here.
 */
export function WorkThread({ messages }: { messages: readonly WorkMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className={styles.threadScroll}>
        <div className={styles.threadEmpty}>
          Ask Theseus anything, or type <code>/board</code>, <code>/doc</code>, or{' '}
          <code>/code</code> below to open a stage.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.threadScroll}>
      <div className={styles.messages}>
        {/* initial={false}: a reloaded thread's existing history should not
            all fly in at once on mount -- only messages appended after
            first render animate. */}
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <WorkThreadMessage key={message.id} message={message} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function runningToolLabel(toolParts: readonly WorkToolPart[]): string | null {
  const running = toolParts.find((part) => part.status === 'running');
  return running ? running.toolName : null;
}

function WorkThreadMessage({ message }: { message: WorkMessage }) {
  const isUser = message.role === 'user';
  const streamingLabel = message.isStreaming ? runningToolLabel(message.toolParts) ?? 'composing' : null;
  const spring = useSpring('snappy');

  return (
    <motion.div
      layout
      className={`${styles.message} ${isUser ? styles.messageUser : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={SETTLE_EXIT}
      transition={spring}
    >
      <span className={styles.messageRole}>{isUser ? 'You' : 'Theseus'}</span>
      {message.text && <div className={styles.messageBody}>{message.text}</div>}
      <AnimatePresence initial={false}>
        {message.toolParts.map((part) => (
          <WorkToolPartView key={part.toolCallId} part={part} />
        ))}
      </AnimatePresence>
      {message.error && <div className={styles.messageBody}>Error: {message.error}</div>}
      <AnimatePresence>
        {streamingLabel && (
          <motion.span
            className={styles.messageStreaming}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={FADE_EXIT}
            transition={spring}
          >
            <span className={styles.messageStreamingDot} aria-hidden="true" />
            {streamingLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function WorkToolPartView({ part }: { part: WorkToolPart }) {
  const kind = resolveToolViewKind(part);
  const spring = useSpring('snappy');
  // useMemo keyed on `part` (a stable reference until this part's own data
  // changes) so this never rebuilds the query -- and therefore never
  // refetches in ObjectSetToolUI -- on unrelated thread re-renders.
  const objectQuery = useMemo(() => (kind === 'object-set' ? objectQueryForFocalIds(part) : null), [kind, part]);

  const body =
    kind === 'memory-recall' ? (
      <MemoryRecallToolUI part={part} />
    ) : kind === 'coordination-ping' ? (
      <CoordinationPingToolUI part={part} />
    ) : kind === 'object-set' && objectQuery ? (
      <ObjectSetToolUI query={objectQuery} host={getWorkBlockHost()} />
    ) : (
      <div className={styles.messageStreaming}>
        <span className={styles.messageStreamingDot} aria-hidden="true" />
        {part.toolName} &middot; {part.status}
      </div>
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={SETTLE_EXIT}
      transition={spring}
    >
      {body}
    </motion.div>
  );
}
