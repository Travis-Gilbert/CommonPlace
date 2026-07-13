'use client';

/* Shared porcelain primitives for the Operator surface. V2 color law: ink is
   calm + information, amber is waiting-on-a-human + open PR, oxblood means
   blocked and nothing else on this screen, green is pass/merged. Fixture
   honesty is one dev-mode dot in the breadcrumb rail — never a badge per card. */

import type { OperatorSourceMode } from '@/lib/theorem-operator';
import styles from './operator.module.css';

export type Tone = 'ok' | 'attention' | undefined;

export function Pill({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

/** The one dev-mode dot. Replaces every FIXTURE badge on the page; hover names
    the mode. Green only when the whole state is live. */
export function DevModeDot({ mode }: { mode: OperatorSourceMode }) {
  return (
    <span
      className={styles.devDot}
      data-mode={mode === 'live' ? 'live' : undefined}
      title={mode === 'live' ? 'live substrate' : 'fixture data'}
      role="img"
      aria-label={mode === 'live' ? 'Live substrate' : 'Fixture data'}
    />
  );
}

export function Dot({ status }: { status: string }) {
  return <span className={styles.dot} data-status={status} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

/** Compact relative age: 3h, 2d, 9d. Whole-number, laptop-friendly. */
export function formatAge(ageMs: number): string {
  const min = Math.round(ageMs / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
