'use client';

// SOURCING: jal-co/ui Kbd (ui.justinlevine.me/r/kbd.json). Structure extraction
// + Int UI reskin. Upstream keycap color schemes (hex palettes) are dropped;
// paint resolves through --ij-* only. ViewSource: package jal-co/ui,
// component Kbd, mode reskin, regime css-vars.

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const kbdVariants = cva(
  'inline-flex items-center justify-center font-ij-mono font-medium leading-none select-none text-ij-ink',
  {
    variants: {
      variant: {
        flat: 'rounded-ij-arc border border-ij-seam-raised bg-transparent text-ij-ink-info',
        raised:
          'rounded-ij-arc border border-ij-seam-raised border-b-2 bg-ij-raised text-ij-ink',
        sculpted:
          'rounded-ij-arc border border-ij-seam-raised border-b-2 bg-ij-chrome text-ij-ink',
      },
      size: {
        sm: 'min-h-5 min-w-5 px-1 text-ij-island-meta',
        md: 'min-h-6 min-w-6 px-1.5 text-ij-island-meta',
        lg: 'min-h-8 min-w-8 px-2 text-ij-island-section',
      },
    },
    defaultVariants: {
      variant: 'raised',
      size: 'md',
    },
  },
);

export type KbdProps = React.ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>;

export function Kbd({ className, variant, size, ...props }: KbdProps) {
  return <kbd className={cn(kbdVariants({ variant, size }), className)} {...props} />;
}

export type KbdComboProps = {
  readonly keys: readonly string[];
  readonly separator?: string;
  readonly variant?: KbdProps['variant'];
  readonly size?: KbdProps['size'];
  readonly className?: string;
};

export function KbdCombo({
  keys,
  separator = '+',
  variant,
  size,
  className,
}: KbdComboProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          {index > 0 ? (
            <span className="font-ij-mono text-ij-ink-info" aria-hidden="true">
              {separator}
            </span>
          ) : null}
          <Kbd variant={variant} size={size}>
            {key}
          </Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}
