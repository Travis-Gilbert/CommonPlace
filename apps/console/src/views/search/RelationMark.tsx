'use client';

// SOURCING: the console icon ledger. Existing normalized control marks provide
// shape-distinct relation annotations without adding a second icon source.

import type { GraphRelation } from '@commonplace/search-stack';
import {
  IconCheck,
  IconInfo,
  IconRecords,
  IconRun,
} from '@/components/shell/icons';

const RELATIONS = {
  KNOWN: {
    Icon: IconCheck,
    label: 'Known',
    className: 'text-ij-gold',
  },
  EXTENDS: {
    Icon: IconRecords,
    label: 'Extends',
    className: 'text-ij-graph',
  },
  CONTRADICTS: {
    Icon: IconRun,
    label: 'Contradicts',
    className: 'text-ij-accent',
  },
  ORPHAN: {
    Icon: IconInfo,
    label: 'Orphan',
    className: 'text-ij-ink-info',
  },
} as const;

export function relationLabel(relation: GraphRelation): string {
  return RELATIONS[relation].label;
}

export function RelationMark({
  relation,
  decorative = false,
}: {
  readonly relation: GraphRelation;
  readonly decorative?: boolean;
}) {
  const { Icon, label, className } = RELATIONS[relation];
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center ${className}`}
      data-search-relation={relation}
    >
      <Icon size={14} />
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
