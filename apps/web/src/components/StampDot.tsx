'use client';

/**
 * StampDot: animated current-stage dot with scatter micro-dots.
 *
 * Plays a brief stamp (scale+rotate) animation on mount, then spawns
 * 3-4 tiny scatter dots that fly outward and fade. Fires only once.
 * Respects prefers-reduced-motion by skipping the animation entirely.
 */

import { useRef, useEffect, useState } from 'react';

interface StampDotProps {
  /** Dot diameter in px */
  size: number;
  /** Fill and border color (CSS value) */
  color: string;
  /** Glow shadow around current dot */
  glow: string;
}

interface ScatterDot {
  id: number;
  angle: number;
  distance: number;
  opacity: number;
}

export default function StampDot({ size, color, glow }: StampDotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scatterDots, setScatterDots] = useState<ScatterDot[]>([]);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) return;

    setAnimated(true);

    // Spawn 3-4 scatter dots
    const count = 3 + Math.floor(Math.random() * 2);
    const dots: ScatterDot[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8,
      distance: 8 + Math.random() * 4,
      opacity: 0.6 + Math.random() * 0.3,
    }));
    setScatterDots(dots);

    // Remove scatter dots after animation completes
    const timer = setTimeout(() => setScatterDots([]), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Main dot with stamp keyframe */}
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          border: `2px solid ${color}`,
          boxShadow: glow,
          animation: animated ? 'stamp 400ms ease-out forwards' : undefined,
        }}
      />

      {/* Scatter micro-dots */}
      {scatterDots.map((dot) => {
        const x = Math.cos(dot.angle) * dot.distance;
        const y = Math.sin(dot.angle) * dot.distance;
        return (
          <span
            key={dot.id}
            style={{
              position: 'absolute',
              width: 2,
              height: 2,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%)`,
              animation: `scatter-out 400ms ease-out forwards`,
              // Custom properties for the scatter animation endpoint
              ['--scatter-x' as string]: `${x}px`,
              ['--scatter-y' as string]: `${y}px`,
              ['--scatter-opacity' as string]: dot.opacity,
            }}
          />
        );
      })}
    </div>
  );
}
