'use client';

// SOURCING: 21st.dev muhammad-binsalman glowing AI chat material extraction
// plus hand-roll canvas. The floating shell pattern is intentionally absent.
// Paint is register-derived, idle draws once, and only streaming owns a loop.

import { useEffect, useRef, useState } from 'react';
import { DUR, useMotionDurations } from '@/motion/motion-tokens';

export function ComposerSheenCanvas({ streaming }: { streaming: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wasStreaming = useRef(false);
  const [commit, setCommit] = useState(false);
  const durations = useMotionDurations();

  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      setCommit(true);
      const timer = window.setTimeout(() => setCommit(false), DUR.fast);
      wasStreaming.current = streaming;
      return () => window.clearTimeout(timer);
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let animation = 0;
    let active = true;
    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.clearRect(0, 0, width, height);
      const styles = getComputedStyle(canvas);
      const accent = styles.getPropertyValue('--ij-accent').trim();
      const gold = styles.getPropertyValue('--ij-gold').trim();
      const pulse = durations.reduced || !streaming ? 0.12 : 0.12 + Math.sin(now / DUR.slow) * 0.035;
      const gradient = context.createLinearGradient(0, height, width, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.44, accent);
      gradient.addColorStop(0.58, commit ? gold : accent);
      gradient.addColorStop(1, 'transparent');
      context.globalAlpha = commit ? 0.24 : pulse;
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.globalAlpha = 1;
      frame += 1;
      canvas.dataset.sheenFrames = String(frame);
      if (active && streaming && !durations.reduced) animation = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(() => draw(performance.now()));
    observer.observe(canvas);
    const start = performance.now();
    draw(start);
    canvas.dataset.idlePaintCost = String(performance.now() - start);
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(animation);
    };
  }, [commit, durations.reduced, streaming]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-composer-sheen
      data-sheen-state={commit ? 'commit' : streaming ? 'streaming' : 'idle'}
      className="pointer-events-none absolute inset-0 h-full w-full rounded-ij-arc"
    />
  );
}
