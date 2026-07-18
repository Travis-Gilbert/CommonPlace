'use client';

// SOURCING: direct material port from the 21st.dev muhammad-binsalman glowing
// AI chat component supplied by Travis. The source's layered translucent
// gradients are retokened, then extended with deterministic stepped bands and
// flecks to preserve its staccato interior at Console scale. Paint remains
// register-derived, idle draws once, and only streaming owns a frame loop.

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
      field.addColorStop(0.12, 'transparent');
      field.addColorStop(0.13, accent);
      field.addColorStop(0.23, accent);
      field.addColorStop(0.24, 'transparent');
      field.addColorStop(0.41, 'transparent');
      field.addColorStop(0.42, agent);
      field.addColorStop(0.51, agent);
      field.addColorStop(0.52, 'transparent');
      field.addColorStop(0.66, 'transparent');
      field.addColorStop(0.67, room);
      field.addColorStop(0.75, room);
      field.addColorStop(0.76, 'transparent');
      field.addColorStop(0.88, 'transparent');
      field.addColorStop(0.89, showCommit ? gold : accent);
      field.addColorStop(0.96, showCommit ? gold : accent);
      field.addColorStop(0.97, 'transparent');
      field.addColorStop(1, 'transparent');
      context.globalAlpha = (showCommit ? 0.2 : 0.1) * pulse;
      context.fillStyle = field;
      context.fillRect(0, 0, width, height);

      const phase = streaming && !durations.reduced ? Math.floor(now / DUR.slow) % 7 : 0;
      const pigments = [accent, agent, room, showCommit ? gold : accent];
      const bandWidth = Math.max(1, Math.round(width / 320));
      for (let index = 0; index < 28; index += 1) {
        const start = ((index * 79 + phase * 23) % (width + height)) - height;
        context.beginPath();
        context.moveTo(start, height);
        context.lineTo(start + bandWidth, height);
        context.lineTo(start + height + bandWidth * 5, 0);
        context.lineTo(start + height + bandWidth * 3, 0);
        context.closePath();
        context.globalAlpha = (index % 4 === 0 ? 0.07 : 0.025) * pulse;
        context.fillStyle = pigments[index % pigments.length];
        context.fill();
      }

      const fleckCount = Math.min(96, Math.max(36, Math.round((width * height) / 18000)));
      for (let index = 0; index < fleckCount; index += 1) {
        const x = (index * 137 + phase * 19) % width;
        const y = (index * 71 + index * index * 3) % height;
        const length = index % 5 === 0 ? bandWidth * 3 : bandWidth;
        context.globalAlpha = (index % 3 === 0 ? 0.09 : 0.035) * pulse;
        context.fillStyle = index % 4 === 0 ? bright : pigments[index % pigments.length];
        context.fillRect(x, y, length, Math.max(1, bandWidth));
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
      data-material-texture="staccato"
      data-sheen-state={durations.reduced ? 'idle' : commit ? 'commit' : streaming ? 'streaming' : 'idle'}
      className="pointer-events-none absolute inset-0 h-full w-full rounded-ij-arc"
    />
  );
}
