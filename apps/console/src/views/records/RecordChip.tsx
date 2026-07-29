'use client';

// SOURCING: Twenty record chip structure (label pill on tint surface).
// Same atom as the model diagram record node: label plus optional tint/ink/icon.

import type { ReactNode } from 'react';
import { hueForTag } from './tints';

export interface RecordChipProps {
  readonly label: string;
  readonly tint?: string;
  readonly ink?: string;
  readonly icon?: ReactNode;
  readonly title?: string;
}

export function RecordChip({ label, tint, ink, icon, title }: RecordChipProps) {
  const hue = tint && ink ? { tint, ink } : hueForTag(label);
  return (
    <span
      className="inline-flex max-w-full items-center gap-rec-sibling-gap truncate px-2 leading-5"
      title={title ?? label}
      style={{
        background: hue.tint,
        color: hue.ink,
        transition: 'var(--rec-clickable-transition)',
      }}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
