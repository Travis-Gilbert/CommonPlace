'use client';

import { useState, useEffect, useRef } from 'react';

const ON_TOPICS = [
  'Curb Extensions',
  'Error Correcting Codes',
  'Wealth Inequality',
  'Justice',
  'Warning Signs',
  'Sidewalk Politics',
  'Zoning as Control',
  'Who Owns the Commons',
  'Design as Power',
];

type Phase = 'typing' | 'holding' | 'erasing';

interface CyclingTaglineProps {
  /** When true, renders light text for dark backgrounds (hero zone) */
  inverted?: boolean;
}

export default function CyclingTagline({ inverted = false }: CyclingTaglineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const topic = ON_TOPICS[currentIndex];

    if (phase === 'typing') {
      if (displayText.length < topic.length) {
        const delay = 55 + Math.random() * 40;
        timeoutRef.current = setTimeout(() => {
          setDisplayText(topic.slice(0, displayText.length + 1));
        }, delay);
      } else {
        setPhase('holding');
      }
    }

    if (phase === 'holding') {
      timeoutRef.current = setTimeout(() => {
        setPhase('erasing');
      }, 2200);
    }

    if (phase === 'erasing') {
      if (displayText.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 30);
      } else {
        setCurrentIndex((prev) => (prev + 1) % ON_TOPICS.length);
        setPhase('typing');
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, displayText, currentIndex]);

  const prefixColor = inverted ? 'var(--color-hero-text-muted)' : undefined;
  const topicColor = inverted ? 'var(--color-terracotta-light)' : undefined;
  const cursorColor = inverted ? 'var(--color-terracotta-light)' : undefined;

  return (
    <div className="flex items-baseline gap-0" aria-live="polite" aria-atomic="true">
      <span
        className={`font-title text-[26px] font-semibold ${inverted ? '' : 'text-ink-secondary'}`}
        style={prefixColor ? { color: prefixColor } : undefined}
      >
        On...&nbsp;
      </span>
      <span
        className={`font-title text-[26px] font-semibold ${inverted ? '' : 'text-terracotta'}`}
        style={topicColor ? { color: topicColor } : undefined}
      >
        {displayText}
      </span>
      <span
        className={`inline-block w-[2px] h-[26px] ml-0.5 translate-y-[3px] ${inverted ? '' : 'bg-terracotta'}`}
        style={{
          animation: phase === 'holding' ? 'blink 0.8s step-end infinite' : 'none',
          opacity: 1,
          backgroundColor: cursorColor ?? undefined,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
