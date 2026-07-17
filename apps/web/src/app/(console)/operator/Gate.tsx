'use client';

/* OP5: the gate. The single mandatory human decision, as a PR review. One card
   per task in review: acceptance marks with cited (linked, not pasted) evidence,
   the cross-review verdict and what the reviewer tried to break, the changed-file
   list, and commit links. Pass is disabled until every acceptance mark is met with
   cited evidence AND a cross-review verdict exists (Invariant 4); the missing item
   is named. Bounce requires stated changes and returns the task to its owner. */

import { useState } from 'react';
import type { GateCard as GateCardData } from '@/lib/theorem-operator';
import { gateReady } from '@/lib/theorem-operator';
import { Pill, Empty } from './parts';
import styles from './operator.module.css';

type GateRunner =
  | { kind: 'pass'; taskId: string }
  | { kind: 'bounce'; taskId: string; requiredChanges: string };

export function Gate({
  cards,
  busy,
  onPass,
  onBounce,
}: {
  cards: GateCardData[];
  busy: string | null;
  onPass: (taskId: string) => void;
  onBounce: (taskId: string, requiredChanges: string) => void;
}) {
  return (
    <section aria-label="Gate">
      <div className={styles.laneHead}>
        <span className={styles.laneHint}>
          Nothing merges without acceptance evidence and a cross-review. The gate reviews the review.
        </span>
      </div>
      {cards.length === 0 ? (
        <Empty>Nothing in review.</Empty>
      ) : (
        <div className={styles.gateStack}>
          {cards.map((card) => (
            <GateCard key={card.taskId} card={card} busy={busy} onPass={onPass} onBounce={onBounce} />
          ))}
        </div>
      )}
    </section>
  );
}

function GateCard({
  card,
  busy,
  onPass,
  onBounce,
}: {
  card: GateCardData;
  busy: string | null;
  onPass: (taskId: string) => void;
  onBounce: (taskId: string, requiredChanges: string) => void;
}) {
  const { ready, missing } = gateReady(card);
  const [bouncing, setBouncing] = useState(false);
  const [reason, setReason] = useState('');
  const isBusy = busy === `gate:${card.taskId}`;

  return (
    <article className={styles.gateCard}>
      <div className={styles.gateHead}>
        <span className={styles.gateGoal}>{card.goal}</span>
      </div>

      {/* Acceptance marks with cited evidence */}
      <div className={styles.gateBlockTitle}>Acceptance</div>
      <ul className={styles.acceptList}>
        {card.acceptance.map((a) => (
          <li key={a.id} className={styles.acceptItem} data-met={a.met || undefined}>
            <span className={styles.acceptMark} data-met={a.met || undefined} aria-hidden="true">
              {a.met ? '✓' : '○'}
            </span>
            <div className={styles.acceptBody}>
              <span className={styles.acceptLabel}>{a.label}</span>
              {a.met &&
                (a.evidence ? (
                  a.evidence.href ? (
                    <a className={styles.acceptEvidence} href={a.evidence.href}>
                      {a.evidence.label}
                    </a>
                  ) : (
                    <span className={styles.acceptEvidence}>{a.evidence.label}</span>
                  )
                ) : (
                  <span className={styles.acceptMissing}>evidence not cited</span>
                ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Cross-review */}
      <div className={styles.gateBlockTitle}>Cross-review</div>
      {card.crossReview ? (
        <div className={styles.review}>
          <div className={styles.reviewTop}>
            <Pill tone={card.crossReview.verdict === 'pass' ? 'ok' : card.crossReview.verdict === 'pending' ? undefined : 'attention'}>
              {card.crossReview.verdict}
            </Pill>
            <span className={`${styles.mono} ${styles.dim}`}>{card.crossReview.reviewer}</span>
          </div>
          <div className={styles.reviewTried}>
            <span className={styles.reviewTriedKey}>tried to break:</span> {card.crossReview.triedToBreak}
          </div>
        </div>
      ) : (
        <div className={styles.reviewMissing}>No cross-review yet: the other head must review the diff first.</div>
      )}

      {/* Changed files + commits */}
      <div className={styles.gateBlockTitle}>Changes</div>
      <ul className={styles.fileList}>
        {card.changedFiles.map((f) => (
          <li key={f.path} className={styles.fileRow}>
            <span className={styles.filePath}>{f.path}</span>
            <span className={styles.fileStat}>
              <span className={styles.added}>+{f.added}</span> <span className={styles.removed}>−{f.removed}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.commitList}>
        {card.commits.map((c) => (
          <a key={c.sha} className={styles.commit} href={c.href} title={c.message}>
            <span className={styles.mono}>{c.sha}</span> {c.message}
          </a>
        ))}
      </div>

      {/* Actions */}
      <div className={styles.gateActions}>
        {!bouncing ? (
          <>
            <button
              className={styles.btnNavy}
              disabled={!ready || isBusy}
              title={ready ? 'Write the gate record and advance to merge-ready' : `Blocked: ${missing.join('; ')}`}
              onClick={() => onPass(card.taskId)}
            >
              Pass
            </button>
            <button className={styles.btn} disabled={isBusy} onClick={() => setBouncing(true)}>
              Bounce
            </button>
            {!ready && <span className={styles.gateMissing}>Pass needs: {missing.join('; ')}.</span>}
          </>
        ) : (
          <div className={styles.bounceBox}>
            <textarea
              className={styles.bounceInput}
              placeholder="Required changes (returned to the owner with a mention)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <div className={styles.bounceActions}>
              <button
                className={styles.btn}
                disabled={!reason.trim() || isBusy}
                onClick={() => {
                  onBounce(card.taskId, reason.trim());
                  setBouncing(false);
                  setReason('');
                }}
              >
                Bounce to {card.owner}
              </button>
              <button className={styles.btn} onClick={() => setBouncing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
