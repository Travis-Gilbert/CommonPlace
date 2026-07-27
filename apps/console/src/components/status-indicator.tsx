// SOURCING: @jalco/status-indicator reskin. Register tokens only
// (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC1/SC4). Upstream status vocabulary
// kept; paint mapped to --ij-* status and ink slots.

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type Status =
  | 'operational'
  | 'degraded'
  | 'partial-outage'
  | 'major-outage'
  | 'maintenance'
  | 'incident'
  | 'unknown';

const STATUS_CONFIG: Record<Status, { label: string; dot: string; text: string }> = {
  operational: {
    label: 'Operational',
    dot: 'bg-ij-ok',
    text: 'text-ij-ok',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-ij-warn',
    text: 'text-ij-warn',
  },
  'partial-outage': {
    label: 'Partial Outage',
    dot: 'bg-ij-warn',
    text: 'text-ij-warn',
  },
  'major-outage': {
    label: 'Major Outage',
    dot: 'bg-ij-error',
    text: 'text-ij-error',
  },
  maintenance: {
    label: 'Maintenance',
    dot: 'bg-ij-running',
    text: 'text-ij-running',
  },
  incident: {
    label: 'Incident',
    dot: 'bg-ij-error',
    text: 'text-ij-error',
  },
  unknown: {
    label: 'Unknown',
    dot: 'bg-ij-ink-disabled',
    text: 'text-ij-ink-info',
  },
};

const statusIndicatorVariants = cva(
  'inline-flex items-center gap-2 rounded-ij-arc border font-medium',
  {
    variants: {
      size: {
        sm: 'h-6 px-2.5 text-[11px] [&>[data-slot=status-dot]]:size-1.5',
        md: 'h-7 px-3 text-xs [&>[data-slot=status-dot]]:size-2',
        lg: 'h-8 px-3.5 text-sm [&>[data-slot=status-dot]]:size-2.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

interface StatusIndicatorProps
  extends Omit<React.ComponentProps<'span'>, 'children'>,
    VariantProps<typeof statusIndicatorVariants> {
  status: Status;
  label?: string;
}

function StatusIndicator({
  status,
  label,
  size,
  className,
  ...props
}: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config.label;

  return (
    <span
      data-slot="status-indicator"
      data-status={status}
      role="status"
      aria-label={displayLabel}
      className={cn(
        statusIndicatorVariants({ size }),
        'border-ij-seam bg-ij-raised text-ij-ink',
        className,
      )}
      {...props}
    >
      <span
        data-slot="status-dot"
        className={cn('relative shrink-0 rounded-full', config.dot)}
        aria-hidden="true"
      >
        <span
          className={cn('absolute inset-0 rounded-full animate-ping opacity-40', config.dot)}
        />
      </span>
      <span className={cn('whitespace-nowrap', config.text)}>{displayLabel}</span>
    </span>
  );
}

export {
  StatusIndicator,
  statusIndicatorVariants,
  STATUS_CONFIG,
  type StatusIndicatorProps,
  type Status,
};
