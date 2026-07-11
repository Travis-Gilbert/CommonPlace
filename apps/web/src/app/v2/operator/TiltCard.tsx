'use client';

/* Porcelain TiltCard. Adapted from the provided Tilt card component: pointer-
   tracked 3D tilt with an optional cursor spotlight. Re-skinned to tokens and
   tamed for furniture duty (tiltLimit 6, scale 1.02 — fifteen degrees is a toy).
   Tilt engages only on hover-capable pointers with motion allowed; on touch or
   prefers-reduced-motion the card is static and every affordance still works. */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './operator.module.css';

export interface TiltCardProps {
  /** Maximum tilt angle in degrees. */
  tiltLimit?: number;
  /** Scale factor on hover. */
  scale?: number;
  /** Perspective distance in pixels. */
  perspective?: number;
  /** "gravitate" follows the cursor, "evade" tilts away. */
  effect?: 'gravitate' | 'evade';
  /** Cursor-following spotlight on hover. */
  spotlight?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const REST = (p: number) => `perspective(${p}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

export function TiltCard({
  tiltLimit = 6,
  scale = 1.02,
  perspective = 1200,
  effect = 'evade',
  spotlight = true,
  className,
  children,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(REST(perspective));
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  // Tilt only where it can be read: fine pointer + motion allowed.
  const [tiltable, setTiltable] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)');
    const apply = () => setTiltable(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const dir = effect === 'evade' ? -1 : 1;

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!tiltable) return;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const xRot = (py - 0.5) * (tiltLimit * 2) * dir;
      const yRot = (px - 0.5) * -(tiltLimit * 2) * dir;
      setTransform(
        `perspective(${perspective}px) rotateX(${xRot}deg) rotateY(${yRot}deg) scale3d(${scale}, ${scale}, ${scale})`,
      );
      if (spotlight) setSpot({ x: px * 100, y: py * 100 });
    },
    [tiltable, tiltLimit, scale, perspective, dir, spotlight],
  );

  const onPointerLeave = useCallback(() => {
    setTransform(REST(perspective));
    setHovered(false);
  }, [perspective]);

  return (
    <div
      ref={cardRef}
      onPointerEnter={() => setHovered(true)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`${styles.tilt}${className ? ` ${className}` : ''}`}
      style={tiltable ? { transform } : undefined}
    >
      {children}
      {spotlight && tiltable && (
        <div className={styles.tiltSpotFrame} style={{ opacity: hovered ? 1 : 0 }} aria-hidden="true">
          <div className={styles.tiltSpot} style={{ left: `${spot.x}%`, top: `${spot.y}%` }} />
        </div>
      )}
    </div>
  );
}
