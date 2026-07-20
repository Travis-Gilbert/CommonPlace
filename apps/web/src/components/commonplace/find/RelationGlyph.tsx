'use client';

// SOURCING: lucide-react (the project's declared iconLibrary in components.json).
// Four distinct marks, no hand-drawn SVG.

/**
 * The relation glyph (SPEC F1, B4). How a result stands against what the person
 * already knows, as a mark rather than a word, so the row stays scannable.
 *
 * The four marks are shape-distinct, not only color-distinct: a solid ring with
 * a check, a branching line, a bolt, and a dashed ring. Color reinforces the
 * register (gold for the harness recognizing something it holds, oxblood for a
 * contradiction, which is a pending decision), it does not carry the meaning
 * alone. The accessible name rides an adjacent visually-hidden label, so the
 * annotation is available to a screen reader rather than being an icon name.
 */

import { CircleCheck, CircleDashed, GitBranchPlus, Zap } from 'lucide-react';
import type { GraphRelation } from '@commonplace/block-view-contracts/search-stack';
import styles from './find.module.css';

const GLYPHS = {
  known: { Icon: CircleCheck, className: styles.glyphKnown, label: 'Known' },
  extends: { Icon: GitBranchPlus, className: styles.glyphExtends, label: 'Extends' },
  contradicts: { Icon: Zap, className: styles.glyphContradicts, label: 'Contradicts' },
  orphan: { Icon: CircleDashed, className: styles.glyphOrphan, label: 'Orphan' },
} as const satisfies Record<GraphRelation, { Icon: unknown; className: string; label: string }>;

export function relationLabel(relation: GraphRelation): string {
  return GLYPHS[relation].label;
}

export function RelationGlyph({
  relation,
  decorative = false,
}: {
  relation: GraphRelation;
  /**
   * True when the surface already prints the relation as a word beside the
   * mark. The sr-only label is then dropped, so a screen reader hears the word
   * once instead of twice.
   */
  decorative?: boolean;
}) {
  const { Icon, className, label } = GLYPHS[relation];
  return (
    <span className={`${styles.glyph} ${className}`}>
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      {decorative ? null : <span className={styles.srOnly}>{label}</span>}
    </span>
  );
}
