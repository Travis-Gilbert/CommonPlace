import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// SOURCING: blocks.so badge (register-skinned variant ladder).

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-ij-arc border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-ij-accent text-ij-ink-bright',
        secondary: 'border-ij-seam bg-ij-chrome text-ij-ink',
        outline: 'border-ij-control-border bg-ij-editor text-ij-ink-info',
        destructive: 'border-transparent bg-ij-error-bg text-ij-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
