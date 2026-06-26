'use client';

/**
 * HeroAccents: deterministic SVG geometric overlay for the hero artifact.
 *
 * Renders circles, connector lines, and rotated tag labels.
 * All positions are seeded from the first tag string so the same
 * essay always produces the same accent layout (no Math.random).
 */

interface HeroAccentsProps {
  tags?: string[];
  category?: string;
  /** Accent color from the essay's palette, defaults to terracotta */
  accentColor?: string;
}

/** Simple string hash (djb2) returning a positive integer. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Seeded PRNG (linear congruential generator). Returns floats in [0, 1). */
function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
  fill: boolean;
  color: string;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Label {
  x: number;
  y: number;
  text: string;
  side: 'left' | 'right';
}

export default function HeroAccents({
  tags = [],
  accentColor = 'var(--color-terracotta)',
}: HeroAccentsProps) {
  const seed = hashString(tags[0] ?? 'default');
  const rng = createRng(seed);

  const gold = 'var(--color-gold)';

  // Generate 4 circles in top-right and bottom-left quadrants
  const circles: Circle[] = [];
  for (let i = 0; i < 4; i++) {
    const inTopRight = i < 2;
    const cx = inTopRight
      ? 55 + rng() * 40 // 55..95%
      : 5 + rng() * 35;  // 5..40%
    const cy = inTopRight
      ? 5 + rng() * 35   // 5..40%
      : 60 + rng() * 35; // 60..95%
    const r = 8 + rng() * 16; // 8..24px radius
    circles.push({
      cx,
      cy,
      r,
      fill: rng() > 0.5,
      color: rng() > 0.5 ? accentColor : gold,
    });
  }

  // Generate 2 connector lines between circle positions
  const lines: Line[] = [
    { x1: circles[0].cx, y1: circles[0].cy, x2: circles[2].cx, y2: circles[2].cy },
    { x1: circles[1].cx, y1: circles[1].cy, x2: circles[3].cx, y2: circles[3].cy },
  ];

  // Generate tag labels (up to 2)
  const labels: Label[] = tags.slice(0, 2).map((tag, i): Label => ({
    x: i === 0 ? 3 : 97,
    y: 30 + rng() * 40,
    text: tag.toUpperCase(),
    side: i === 0 ? 'left' : 'right',
  }));

  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Connector lines */}
      {lines.map((line, i) => (
        <line
          key={`line-${i}`}
          x1={`${line.x1}%`}
          y1={`${line.y1}%`}
          x2={`${line.x2}%`}
          y2={`${line.y2}%`}
          stroke={gold}
          strokeWidth={0.3}
          opacity={0.4}
        />
      ))}

      {/* Circles */}
      {circles.map((c, i) => (
        <circle
          key={`circle-${i}`}
          cx={`${c.cx}%`}
          cy={`${c.cy}%`}
          r={c.r}
          fill={c.fill ? c.color : 'none'}
          stroke={c.color}
          strokeWidth={c.fill ? 0 : 0.8}
          opacity={0.6}
        />
      ))}

      {/* Tag labels */}
      {labels.map((label, i) => (
        <text
          key={`label-${i}`}
          x={`${label.x}%`}
          y={`${label.y}%`}
          fill="var(--color-hero-text-muted)"
          fontSize={3}
          fontFamily="var(--font-metadata)"
          letterSpacing="0.1em"
          transform={`rotate(${label.side === 'left' ? -90 : 90}, ${label.x}, ${label.y})`}
          textAnchor="middle"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}
