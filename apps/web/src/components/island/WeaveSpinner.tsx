'use client';

/**
 * WeaveSpinner — web port of WeaveSpinner.native.tsx. Four threads weave around
 * a pulsing central node: the "machine is thinking" signal. The native version
 * animates via Reanimated CSS keyframes; this one uses real CSS @keyframes
 * (WeaveSpinner.module.css) and computes the glow rgba tiers from the colour
 * prop the same way the native `hexToRgba` did. Reduced motion collapses to the
 * static glowing node.
 */

import * as React from 'react';
import styles from './WeaveSpinner.module.css';

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export interface WeaveSpinnerProps {
  /** Rendered box size in px (the 160px reference stage is scaled to fit). */
  size?: number;
  /** Hex colour; default is the gold-light machine-surface signal. */
  color?: string;
}

export function WeaveSpinner({ size = 56, color = '#E0BC60' }: WeaveSpinnerProps) {
  const vars = {
    '--wv': color,
    '--wv-60': hexToRgba(color, 0.6),
    '--wv-80': hexToRgba(color, 0.8),
    '--wv-glow': hexToRgba(color, 0.5),
  } as React.CSSProperties;

  return (
    <div style={{ position: 'relative', width: size, height: size }} role="status" aria-label="Thinking">
      <div
        className={styles.stage}
        style={{ ...vars, transform: `translate(-50%, -50%) scale(${size / 160})` }}
      >
        <div className={`${styles.thread} ${styles.horiz} ${styles.t1}`} />
        <div className={`${styles.thread} ${styles.vert} ${styles.t2}`} />
        <div className={`${styles.thread} ${styles.horiz} ${styles.t3}`} />
        <div className={`${styles.thread} ${styles.vert} ${styles.t4}`} />
        <div className={styles.node} />
      </div>
    </div>
  );
}

export default WeaveSpinner;
