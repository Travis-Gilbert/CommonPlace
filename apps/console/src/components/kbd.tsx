// SOURCING: @jalco/kbd reskin. Register tokens only
// (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC1). Named color schemes from
// upstream are dropped; console chrome uses --ij-* exclusively.

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const kbdVariants = cva(
  'inline-flex items-center justify-center font-mono font-medium leading-none select-none',
  {
    variants: {
      variant: {
        flat: ['rounded-ij-arc border border-ij-seam bg-transparent text-ij-ink-info'],
        raised: [
          'rounded-ij-arc border border-ij-seam bg-ij-chrome text-ij-ink',
          'border-b-[2px] border-b-ij-seam-raised',
        ],
        sculpted: [
          'rounded-ij-arc text-ij-ink',
          'border border-ij-seam border-b-[3px] border-b-ij-seam-raised',
          'bg-ij-raised',
        ],
      },
      size: {
        sm: 'min-h-5 min-w-5 px-1 text-[10px]',
        md: 'min-h-6 min-w-6 px-1.5 text-[11px]',
        lg: 'min-h-8 min-w-8 px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'raised',
      size: 'md',
    },
  },
);

type KbdVariantProps = VariantProps<typeof kbdVariants>;

interface KbdProps extends React.ComponentProps<'kbd'>, KbdVariantProps {}

function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant, size }), className)}
      {...props}
    />
  );
}

interface KbdComboProps {
  keys: readonly string[];
  size?: KbdVariantProps['size'];
  variant?: KbdVariantProps['variant'];
  className?: string;
  separator?: string;
}

function KbdCombo({
  keys,
  size = 'sm',
  variant = 'raised',
  className,
  separator = '',
}: KbdComboProps) {
  return (
    <span data-slot="kbd-combo" className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          {index > 0 && separator ? (
            <span className="text-ij-ink-disabled" aria-hidden="true">
              {separator}
            </span>
          ) : null}
          <Kbd size={size} variant={variant}>
            {key}
          </Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

export { Kbd, KbdCombo, kbdVariants };
export type { KbdProps, KbdComboProps };
