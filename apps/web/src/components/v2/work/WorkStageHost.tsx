'use client';

import { X } from 'lucide-react';
import { motion } from 'motion/react';
import type { WorkStage } from '@/lib/work-surface/omnibar';
import { useSpring } from '@/lib/work-surface/work-motion';
import { WorkBoard } from './board/WorkBoard';
import { WorkTextEditor } from './text/WorkTextEditor';
import styles from './work.module.css';

const STAGE_LABEL: Record<WorkStage['kind'], string> = {
  board: 'Board',
  doc: 'Doc',
  code: 'Code',
};

export function WorkStageHost({ stage, onClose }: { stage: WorkStage; onClose: () => void }) {
  // Stage dock spring: this component only mounts once per "dock open"
  // (switching /doc -> /code while the dock is already open re-keys the
  // inner editor below, not this wrapper), so the entrance spring plays
  // once, when the dock first arrives -- not on every kind switch.
  const spring = useSpring('gentle');

  return (
    <motion.div
      className={styles.stage}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={spring}
    >
      <div className={styles.stageHead}>
        <span className={styles.stageKicker}>
          {STAGE_LABEL[stage.kind]}
          {stage.itemId ? ` \u00b7 ${stage.itemId}` : ''}
        </span>
        <button
          type="button"
          className={styles.stageClose}
          onClick={onClose}
          aria-label={`Close ${STAGE_LABEL[stage.kind]} stage`}
        >
          <X className="p-glyph" size={15} />
        </button>
      </div>
      <div className={styles.stageFullBleedBody}>
        {/* key=kind+itemId remounts the stage's editor (resetting its
            load/save state cleanly) whenever the omnibar switches to a
            different stage kind or a different backing item. */}
        {stage.kind === 'board' ? (
          <WorkBoard key={`board:${stage.itemId ?? 'default'}`} boardId={stage.itemId} />
        ) : (
          <WorkTextEditor
            key={`${stage.kind}:${stage.itemId ?? 'default'}`}
            kind={stage.kind}
            itemId={stage.itemId}
          />
        )}
      </div>
    </motion.div>
  );
}

