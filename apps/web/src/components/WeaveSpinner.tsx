'use client';

/**
 * WeaveSpinner: the "machine is thinking" signal. Four threads weave around a
 * pulsing central node. This is the single canonical web copy, consolidated from
 * the former src/components/island/WeaveSpinner.tsx and
 * src/components/commonplace/views/WeaveSpinner.tsx (which were choreographically
 * identical). It accepts both prior APIs: a numeric px size or a preset, plus an
 * optional colour and className. Stays visually equivalent to the mobile Reanimated
 * port. Reduced motion collapses to the static glowing node (the module CSS gates
 * animation behind prefers-reduced-motion: no-preference).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import styles from './WeaveSpinner.module.css';

const PRESET_SIZE = { default: 160, compact: 42 } as const;

export interface WeaveSpinnerProps {
  /** Box size: a preset name or an explicit px value. */
  size?: number | keyof typeof PRESET_SIZE;
  /** Hex colour; default is the gold-light machine-surface signal ("gold shows"). */
  color?: string;
  className?: string;
}

export function WeaveSpinner({ size = 'default', color = '#E0BC60', className }: WeaveSpinnerProps) {
  const px = typeof size === 'number' ? size : PRESET_SIZE[size];
  const vars = {
    '--weave-spinner-color': color,
    '--weave-spinner-size': `${px}px`,
    '--weave-spinner-node': `${(px * 12) / 160}px`,
    '--weave-spinner-thread': `${px >= 80 ? 2 : 1}px`,
    '--weave-spinner-travel': `${(px * 40) / 160}px`,
  } as React.CSSProperties;

  return (
    <div className={cn(styles.wrapper, className)} role="status" aria-label="Thinking">
      <div className={styles.container} style={vars}>
        <div className={cn(styles.thread, styles.t1)} />
        <div className={cn(styles.thread, styles.t2)} />
        <div className={cn(styles.thread, styles.t3)} />
        <div className={cn(styles.thread, styles.t4)} />
        <div className={styles.node} />
      </div>
    </div>
  );
}

export default WeaveSpinner;
