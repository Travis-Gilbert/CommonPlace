'use client';

/* Shared porcelain primitives for the Operator surface. Same restraint as the
   Workroom Control Center: ink shades, one rubric-red accent for attention,
   green for ready/done. State is material, never an edge stripe. */

import type { OperatorSource } from '@/lib/theorem-operator';
import styles from './operator.module.css';

export type Tone = 'ok' | 'attention' | undefined;

export function statusTone(status: string): Tone {
  switch (status) {
    case 'done':
    case 'passed':
    case 'merge-ready':
    case 'pass':
    case 'approved':
    case 'ready':
    case 'active':
      return 'ok';
    case 'blocked':
    case 'failed':
    case 'fail':
    case 'bounced':
    case 'deferred':
    case 'pending':
      return 'attention';
    default:
      return undefined;
  }
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {children}
    </span>
  );
}

export function SourceBadge({ source }: { source: OperatorSource }) {
  return (
    <span
      className={styles.sourceBadge}
      data-mode={source.mode}
      title={source.message ?? source.endpoint ?? source.label}
    >
      {source.mode}
    </span>
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
