/**
 * RoleBadge: Source role indicator (Primary, Data, Background, etc.)
 *
 * Color varies by role to communicate the source's function
 * in the research. Space Mono 10px uppercase.
 */

const ROLE_LABELS: Record<string, string> = {
  primary: 'Primary Source',
  background: 'Background',
  inspiration: 'Inspiration',
  data: 'Data / Evidence',
  counterargument: 'Counterargument',
  methodology: 'Methodology',
  reference: 'Reference',
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  primary:          { bg: 'bg-terracotta',       text: 'text-surface' },
  data:             { bg: 'bg-gold',             text: 'text-ink' },
  background:       { bg: 'bg-bg-alt',           text: 'text-ink-muted' },
  inspiration:      { bg: 'bg-terracotta-light',  text: 'text-surface' },
  counterargument:  { bg: 'bg-error',            text: 'text-surface' },
  methodology:      { bg: 'bg-success',          text: 'text-surface' },
  reference:        { bg: 'bg-border',           text: 'text-ink-muted' },
};

interface RoleBadgeProps {
  role: string;
}

export default function RoleBadge({ role }: RoleBadgeProps) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.reference;
  return (
    <span className={`inline-block font-mono-alt text-[10px] font-normal uppercase tracking-[0.08em] px-2 py-[2px] rounded-[3px] whitespace-nowrap ${colors.bg} ${colors.text}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}
