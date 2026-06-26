'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import rough from 'roughjs';
import type { ThreadPair } from '@/lib/connectionEngine';
import { WEIGHT_STROKE } from '@/lib/connectionEngine';

interface ThreadLinesProps {
  pairs: ThreadPair[];
  /** CSS selector for the container that holds the cards with data-slug attributes */
  containerSelector?: string;
}

/** Debounce delay for ResizeObserver recalculation */
const RESIZE_DEBOUNCE_MS = 250;

interface ArcEndpoint {
  x: number;
  y: number;
}

interface ResolvedArc {
  from: ArcEndpoint;
  to: ArcEndpoint;
  pair: ThreadPair;
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export default function ThreadLines({
  pairs,
  containerSelector,
}: ThreadLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [arcs, setArcs] = useState<ResolvedArc[]>([]);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Measure card positions and resolve arcs
  const measureArcs = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const container = containerSelector
      ? wrapper.closest(containerSelector) ?? wrapper.parentElement
      : wrapper.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const resolved: ResolvedArc[] = [];

    for (const pair of pairs) {
      const fromEl = container.querySelector(`[data-slug="${pair.fromSlug}"]`);
      const toEl = container.querySelector(`[data-slug="${pair.toSlug}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      resolved.push({
        from: {
          x: fromRect.left + fromRect.width / 2 - containerRect.left,
          y: fromRect.top + fromRect.height / 2 - containerRect.top,
        },
        to: {
          x: toRect.left + toRect.width / 2 - containerRect.left,
          y: toRect.top + toRect.height / 2 - containerRect.top,
        },
        pair,
      });
    }

    setArcs(resolved);
  }, [pairs, containerSelector]);

  const measureDebounced = useCallback(() => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(measureArcs, RESIZE_DEBOUNCE_MS);
  }, [measureArcs]);

  // Initial measurement + resize observer
  useEffect(() => {
    // Wait for layout to settle
    const timer = setTimeout(measureArcs, 100);

    const observer = new ResizeObserver(measureDebounced);
    const wrapper = wrapperRef.current;
    if (wrapper?.parentElement) {
      observer.observe(wrapper.parentElement);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [measureArcs, measureDebounced]);

  // Draw arcs on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || arcs.length === 0) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rc = rough.canvas(canvas);

    for (const arc of arcs) {
      const isConnected =
        hoveredSlug === arc.pair.fromSlug ||
        hoveredSlug === arc.pair.toSlug;
      const isDimmed = hoveredSlug !== null && !isConnected;

      const opacity = isDimmed ? 0.12 : hoveredSlug !== null ? 0.6 : 0.25;

      ctx.globalAlpha = opacity;

      // Bezier control points: arc curves outward
      const midX = (arc.from.x + arc.to.x) / 2;
      const midY = (arc.from.y + arc.to.y) / 2;
      const dx = arc.to.x - arc.from.x;
      const dy = arc.to.y - arc.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular offset for the arc (proportional to distance)
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const arcOffset = Math.min(dist * 0.3, 80);

      rc.curve(
        [
          [arc.from.x, arc.from.y],
          [midX + perpX * arcOffset, midY + perpY * arcOffset],
          [arc.to.x, arc.to.y],
        ],
        {
          roughness: 1.2,
          strokeWidth: WEIGHT_STROKE[arc.pair.weight],
          stroke: arc.pair.color,
          bowing: 0.5,
          seed: hashSeed(`${arc.pair.fromSlug}-${arc.pair.toSlug}`),
        },
      );
    }

    ctx.globalAlpha = 1;
  }, [arcs, hoveredSlug]);

  // IntersectionObserver: draw-on animation
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || drawn) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) {
      setDrawn(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);

  // Listen for hover on cards with data-slug
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const parent = wrapper.parentElement;
    if (!parent) return;

    function handleMouseOver(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        setHoveredSlug(card.getAttribute('data-slug'));
      }
    }

    function handleMouseOut(e: MouseEvent) {
      const card = (e.target as HTMLElement).closest('[data-slug]');
      if (card) {
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !card.contains(related)) {
          setHoveredSlug(null);
        }
      }
    }

    parent.addEventListener('mouseover', handleMouseOver);
    parent.addEventListener('mouseout', handleMouseOut);

    return () => {
      parent.removeEventListener('mouseover', handleMouseOver);
      parent.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  if (pairs.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 pointer-events-none hidden md:block"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          opacity: drawn ? 1 : 0,
          transition: 'opacity 600ms ease-out',
        }}
      />
    </div>
  );
}
