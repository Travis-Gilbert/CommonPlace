'use client';

// SOURCING: damianricobelli/shadcn-linear-combobox. Structure extraction +
// Int UI reskin. Priority icons use currentColor (no hex fills). Popover +
// cmdk already in the console dependency set. ViewSource: package
// damianricobelli/shadcn-linear-combobox, component LinearCombobox, mode
// reskin, regime css-vars.

import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { Kbd } from '@/components/jalco/kbd';

export type LinearPriorityValue = 'no-priority' | 'urgent' | 'high' | 'medium' | 'low';

export type LinearPriority = {
  readonly value: LinearPriorityValue;
  readonly label: string;
};

const PRIORITIES: readonly LinearPriority[] = [
  { value: 'no-priority', label: 'No priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

const PRIORITY_INK: Record<LinearPriorityValue, string> = {
  'no-priority': 'text-ij-ink-info',
  urgent: 'text-ij-error',
  high: 'text-ij-warn',
  medium: 'text-ij-link',
  low: 'text-ij-ink-info',
};

export type LinearComboboxProps = {
  readonly value?: LinearPriorityValue | null;
  readonly onChange?: (value: LinearPriorityValue) => void;
  readonly className?: string;
  readonly hotkeyHint?: string;
};

export function LinearCombobox({
  value = null,
  onChange,
  className,
  hotkeyHint = 'P',
}: LinearComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = useMemo(
    () => PRIORITIES.find((priority) => priority.value === value) ?? null,
    [value],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-ij-control items-center gap-2 rounded-ij-arc border border-ij-control-border bg-ij-chrome px-2 text-ij-ink hover:bg-ij-hover-surface',
            className,
          )}
        >
          <span className={selected ? PRIORITY_INK[selected.value] : 'text-ij-ink-info'}>
            {selected?.label ?? 'Set priority'}
          </span>
          <Kbd size="sm">{hotkeyHint}</Kbd>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-64 overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-1"
          style={{ boxShadow: 'var(--ij-popover-shadow)' }}
        >
          <Command shouldFilter className="flex flex-col">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Set priority..."
              className="h-ij-control border-b border-ij-seam bg-transparent px-2 text-ij-ink outline-none placeholder:text-ij-ink-disabled"
            />
            <Command.List className="max-h-56 overflow-auto py-1">
              <Command.Empty className="px-2 py-2 text-ij-ink-info">No match.</Command.Empty>
              <Command.Group>
                {PRIORITIES.map((priority) => (
                  <Command.Item
                    key={priority.value}
                    value={priority.label}
                    onSelect={() => {
                      onChange?.(priority.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'flex cursor-default items-center gap-2 rounded-ij-arc px-2 py-1.5 text-ij-ink aria-selected:bg-ij-selection',
                      PRIORITY_INK[priority.value],
                    )}
                  >
                    <span className="flex-1">{priority.label}</span>
                    {selected?.value === priority.value ? (
                      <span className="font-ij-mono text-ij-accent" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
