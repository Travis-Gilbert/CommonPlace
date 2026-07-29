'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { IconCheck } from '@/components/shell/icons';
import { cn } from '@/lib/utils';

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-ij-arc border border-ij-control-border bg-ij-editor text-ij-ink outline-none focus-visible:border-ij-accent focus-visible:ring-2 focus-visible:ring-ij-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ij-accent data-[state=checked]:bg-ij-accent data-[state=checked]:text-ij-bright',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <IconCheck size={14} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
