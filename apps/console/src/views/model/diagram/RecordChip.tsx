'use client';

// SOURCING: jalco repo-card kind chip, retokened to register tint and ink vars.

import type { ReactNode } from 'react';

export interface RecordChipProps {
  readonly label: string;
  readonly tint: string;
  readonly ink: string;
  readonly icon?: ReactNode;
  readonly className?: string;
}

/** Single record reference chip used across model diagram nodes. */
export function RecordChip({ label, tint, ink, icon, className }: RecordChipProps) {
  return (
    <span
      className={[
        'inline-flex max-w-full items-center gap-1 overflow-hidden rounded-ij-arc px-1.5 font-ij-mono text-xs leading-5',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={{
        background: tint,
        color: ink,
        transition: 'var(--rec-clickable-transition)',
      }}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
