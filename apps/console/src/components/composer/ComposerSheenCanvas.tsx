'use client';

// SOURCING: direct material port from the 21st.dev muhammad-binsalman glowing
// AI chat component supplied by Travis. The source's layered translucent
// gradients are retokened as a restrained low-chroma wash with sparse flecks.
// The source has no repeated stripe geometry, so paint remains quiet at every
// Console width. Idle draws once, and only streaming owns a frame loop.

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
      // Long enough for the capture oracle to observe the flash (DUR.fast was
      // shorter than Playwright's attribute poll in CI).
      const timer = window.setTimeout(() => setCommit(false), DUR.slow);
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
    let pendingFrame: number | null = null;
    let active = true;
    const draw = (now: number) => {
      pendingFrame = null;
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
      const agent = styles.getPropertyValue('--ij-agent').trim();
      const room = styles.getPropertyValue('--ij-room').trim();
      const bright = styles.getPropertyValue('--ij-ink-bright').trim();
      const pulse = durations.reduced || !streaming ? 1 : 1 + Math.sin(now / DUR.slow) * 0.08;
      const showCommit = commit && !durations.reduced;

      const field = context.createLinearGradient(0, height, width, 0);
      field.addColorStop(0, 'transparent');
      field.addColorStop(0.22, accent);
      field.addColorStop(0.56, agent);
      field.addColorStop(0.8, room);
      field.addColorStop(0.92, showCommit ? gold : agent);
      field.addColorStop(1, 'transparent');
      context.globalAlpha = (showCommit ? 0.08 : 0.032) * pulse;
      context.fillStyle = field;
      context.fillRect(0, 0, width, height);

      const phase = streaming && !durations.reduced ? Math.floor(now / DUR.slow) % 7 : 0;
      const pigments = [accent, agent, room, showCommit ? gold : accent];
      const fleckSize = Math.max(1, Math.round(width / 960));
      const fleckCount = Math.min(24, Math.max(12, Math.round((width * height) / 72000)));
      for (let index = 0; index < fleckCount; index += 1) {
        const x = (index * 137 + phase * 7) % width;
        const y = (index * 71 + index * index * 3) % height;
        context.globalAlpha = (index % 3 === 0 ? 0.024 : 0.009) * pulse;
        context.fillStyle = index % 4 === 0 ? bright : pigments[index % pigments.length];
        context.fillRect(x, y, fleckSize, fleckSize);
      }

      context.globalAlpha = 1;
      frame += 1;
      canvas.dataset.sheenFrames = String(frame);
      if (active && streaming && !durations.reduced) pendingFrame = requestAnimationFrame(draw);
    };
    const scheduleDraw = () => {
      if (pendingFrame === null) pendingFrame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(canvas);
    const start = performance.now();
    draw(start);
    canvas.dataset.idlePaintCost = String(performance.now() - start);
    return () => {
      active = false;
      observer.disconnect();
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    };
  }, [commit, durations.reduced, streaming]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-composer-sheen
      data-material-texture="soft-wash"
      data-sheen-state={durations.reduced ? 'idle' : commit ? 'commit' : streaming ? 'streaming' : 'idle'}
      className="pointer-events-none absolute inset-0 h-full w-full rounded-ij-arc"
    />
  );
}
