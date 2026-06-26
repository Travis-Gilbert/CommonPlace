import type { ReactNode } from 'react';

interface MarginNoteProps {
  children: ReactNode;
  /** Position relative to parent content */
  position?: 'right' | 'inline';
  /** Optional color override (CSS value) */
  color?: string;
}

export default function MarginNote({
  children,
  position = 'inline',
  color,
}: MarginNoteProps) {
  if (position === 'right') {
    return (
      <span
        className="hidden lg:block absolute -right-48 top-0 w-40 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-light leading-relaxed select-none"
        style={color ? { color } : undefined}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className="block font-mono text-[10px] uppercase tracking-[0.08em] text-ink-light select-none"
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}
