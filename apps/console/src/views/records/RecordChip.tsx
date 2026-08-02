'use client';

// SOURCING: twenty-ui `Tag` (packages/twenty-ui, hard fork). TU4 re-seat: the
// hand-rolled span that painted a label on a tint surface is gone. Tag carries
// the same anatomy plus the overflow tooltip, the icon slot, and the
// interactive affordance the hand-rolled version never had; the paint comes
// from the token generator, so the chip and the console's row tints resolve to
// one register.

import type { ReactNode } from 'react';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import type { IconComponent } from 'twenty-ui/icon';
import { hueForTag } from './tints';

export interface RecordChipProps {
  readonly label: string;
  readonly color?: TagColor;
  readonly Icon?: IconComponent;
  readonly onClick?: () => void;
}

export function RecordChip({ label, color, Icon, onClick }: RecordChipProps) {
  return (
    <Tag
      color={color ?? hueForTag(label)}
      text={label}
      Icon={Icon}
      onClick={onClick}
    />
  );
}

/** Row wrapper for cells that place several chips side by side. */
export function RecordChipRow({ children }: { readonly children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-rec-sibling-gap">{children}</span>
  );
}
