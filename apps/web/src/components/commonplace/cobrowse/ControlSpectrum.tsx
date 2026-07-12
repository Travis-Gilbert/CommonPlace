'use client';

/**
 * Control spectrum (HANDOFF-COBROWSE-PRESENCE D2): Watch / Pair / Drive mapped
 * to the engine control modes agent_drive / pair / human_drive. Persistent in
 * the browser chrome while a co-browse tab is active; one press per mode
 * change, firing on pointer-down per SPEC-UX-PHYSICS D5.
 */

import styles from './cobrowse.module.css';
import type { CoBrowseMode } from './useCoBrowseSession';

const SEGMENTS: { mode: CoBrowseMode; label: string }[] = [
  { mode: 'watch', label: 'Watch' },
  { mode: 'pair', label: 'Pair' },
  { mode: 'drive', label: 'Drive' },
];

export function ControlSpectrum({
  mode,
  onChange,
}: {
  mode: CoBrowseMode;
  onChange: (mode: CoBrowseMode) => void;
}) {
  return (
    <div className={styles.spectrum} role="radiogroup" aria-label="Control mode">
      {SEGMENTS.map((segment) => (
        <button
          key={segment.mode}
          type="button"
          role="radio"
          aria-checked={mode === segment.mode}
          className={
            mode === segment.mode
              ? `${styles.segment} ${styles.segmentActive}`
              : styles.segment
          }
          onPointerDown={() => onChange(segment.mode)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onChange(segment.mode);
          }}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
