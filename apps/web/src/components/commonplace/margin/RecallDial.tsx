'use client';

// SOURCING: none; the D7 recall dial UI (HANDOFF-MARGIN-RECALL). Mirrors the co-browse
// ControlSpectrum (a three-position radiogroup, one press per change firing on pointer-down
// per SPEC-UX-PHYSICS D5, full ARIA). The state model, labels, and hints come from
// ./recall-dial; no upstream component library. Controlled component: the parent owns the
// policy and persists it, so this paints and emits only.

import styles from './RecallDial.module.css';
import {
  RECALL_POLICIES,
  recallPolicyHint,
  recallPolicyLabel,
  type RecallPolicy,
} from '@/lib/margin-recall/recall-dial';

export function RecallDial({
  policy,
  onChange,
  label = 'Recall',
}: {
  policy: RecallPolicy;
  onChange: (policy: RecallPolicy) => void;
  label?: string;
}) {
  return (
    <div className={styles.dial}>
      <div className={styles.track} role="radiogroup" aria-label={label}>
        {RECALL_POLICIES.map((option) => {
          const active = option === policy;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              className={
                active ? `${styles.segment} ${styles.segmentActive}` : styles.segment
              }
              onPointerDown={() => onChange(option)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onChange(option);
              }}
            >
              {recallPolicyLabel(option)}
            </button>
          );
        })}
      </div>
      <div className={styles.hint}>{recallPolicyHint(policy)}</div>
    </div>
  );
}
