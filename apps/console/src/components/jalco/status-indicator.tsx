// SOURCING: jal-co/ui StatusIndicator (ui.justinlevine.me/r/status-indicator.json).
// Structure extraction + Int UI reskin. Upstream zinc/emerald/amber palette
// utilities map to --ij-ok / --ij-warn / --ij-error / --ij-link / --ij-ink-info.
// ViewSource: package jal-co/ui, component StatusIndicator, mode reskin,
// regime css-vars.

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export type Status =
  | 'operational'
  | 'degraded'
  | 'partial-outage'
  | 'major-outage'
  | 'maintenance'
  | 'incident'
  | 'unknown';

const STATUS_CONFIG: Record<Status, { label: string; dot: string; text: string }> = {
  operational: { label: 'Operational', dot: 'bg-ij-ok', text: 'text-ij-ok' },
  degraded: { label: 'Degraded', dot: 'bg-ij-warn', text: 'text-ij-warn' },
  'partial-outage': { label: 'Partial Outage', dot: 'bg-ij-warn', text: 'text-ij-warn' },
  'major-outage': { label: 'Major Outage', dot: 'bg-ij-error', text: 'text-ij-error' },
  maintenance: { label: 'Maintenance', dot: 'bg-ij-link', text: 'text-ij-link' },
  incident: { label: 'Incident', dot: 'bg-ij-error', text: 'text-ij-error' },
  unknown: { label: 'Unknown', dot: 'bg-ij-ink-disabled', text: 'text-ij-ink-info' },
};

const statusIndicatorVariants = cva(
  'inline-flex items-center gap-2 rounded-ij-arc border border-ij-seam-raised bg-ij-chrome font-medium',
  {
    variants: {
      size: {
        sm: 'h-6 px-2.5 text-ij-island-meta',
        md: 'h-7 px-3 text-ij-island-section',
        lg: 'h-8 px-3.5 text-ij-island-title',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type StatusIndicatorProps = {
  readonly status: Status;
  readonly label?: string;
  readonly className?: string;
} & VariantProps<typeof statusIndicatorVariants>;

export function StatusIndicator({ status, label, size, className }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn(statusIndicatorVariants({ size }), className)}>
      <span
        data-slot="status-dot"
        className={cn('size-2 shrink-0 rounded-full', config.dot)}
        aria-hidden="true"
      />
      <span className={config.text}>{label ?? config.label}</span>
    </span>
  );
}
