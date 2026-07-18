'use client';

/* BayCard story: every state on one screen, fixture-only. Not in the rail;
   exists so the card can be critiqued in isolation (spec process step 2) and
   revisited when states change. Route: /operator/story */

import type { Bay, OperatorTask } from '@/lib/theorem-operator';
import { fixtureSource } from '@/lib/theorem-operator';
import { BayCard } from '../BayCard';
import styles from '../operator.module.css';

const MIN = 60 * 1000;

function task(id: string, goal: string, over: Partial<OperatorTask> = {}): OperatorTask {
  return {
    id,
    goal,
    lane: 'now',
    status: 'claimed',
    priority: 0,
    prerequisites: [],
    claim: { head: 'claude-code', claimedAt: new Date(Date.now() - 42 * MIN).toISOString() },
    ageMs: 42 * MIN,
    checklist: { done: 4, total: 6 },
    source: fixtureSource('story'),
    ...over,
  };
}

function bay(label: string, over: Partial<Bay>): Bay {
  return {
    head: 'claude-code',
    label,
    task: null,
    streaming: false,
    prLight: 'none',
    source: fixtureSource('story'),
    ...over,
  };
}

const STATES: { name: string; bay: Bay; urgency: 'calm' | 'waiting' | 'blocked' }[] = [
  {
    name: 'calm + streaming, PR open, 4/6',
    urgency: 'calm',
    bay: bay('Claude Code', {
      task: task('t1', 'OP4 run drawer: receipts inside CommonPlace'),
      streaming: true,
      prLight: 'open',
      lastStep: 'Verify First v1 to v4 checked',
    }),
  },
  {
    name: 'waiting on a human (amber border + warm shadow), idle',
    urgency: 'waiting',
    bay: bay('Codex', {
      task: task('t2', 'OP1 intake parser: specs materialize as tasks', { checklist: { done: 5, total: 6 } }),
      prLight: 'open',
      lastStep: 'empty-Build-Table log path',
    }),
  },
  {
    name: 'blocked (oxblood border + shadow)',
    urgency: 'blocked',
    bay: bay('Claude Code', {
      task: task('t3', 'OP5 the gate: review view with evidence', {
        prerequisites: [{ taskId: 't1', goal: 'OP4 run drawer', met: false }],
        checklist: { done: 0, total: 5 },
      }),
      prLight: 'none',
      lastStep: 'waiting on OP4',
    }),
  },
  {
    name: 'merged (green PR light), 6/6',
    urgency: 'calm',
    bay: bay('Codex', {
      task: task('t4', 'OP2 the queue and the bays', { checklist: { done: 6, total: 6 } }),
      prLight: 'merged',
      lastStep: 'gate passed',
    }),
  },
  { name: 'empty bay', urgency: 'calm', bay: bay('Codex', {}) },
];

export default function BayCardStory() {
  return (
    <div className={styles.col} style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div className={styles.crumbRail}>
        <span className={styles.crumb}>Harness / Operator / BayCard story</span>
      </div>
      <div className={styles.bayStrip} style={{ marginTop: 16 }}>
        {STATES.map((s) => (
          <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BayCard bay={s.bay} urgency={s.urgency} onOpenRoom={() => {}} />
            <span className={`${styles.mono} ${styles.dim}`}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
