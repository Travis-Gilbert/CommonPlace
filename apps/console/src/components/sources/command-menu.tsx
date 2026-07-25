'use client';

// SOURCING: blocks.so command-menu-02 structure on installed cmdk. Auth blocks
// from blocks.so are not mounted (console auth is next-auth AccountView). This
// is the shared command palette shell for editor inline affordances and the
// right-click-avoidance container. ViewSource: package blocks.so, component
// CommandMenu, mode reskin, regime css-vars.

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { KbdCombo } from '@/components/jalco/kbd';

export type CommandMenuItem = {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly shortcut?: readonly string[];
  readonly onSelect: () => void;
};

export type CommandMenuProps = {
  readonly items: readonly CommandMenuItem[];
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placeholder?: string;
  readonly className?: string;
};

export function CommandMenu({
  items,
  open: openProp,
  onOpenChange,
  placeholder = 'Type a command...',
  className,
}: CommandMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const groups = new Map<string, CommandMenuItem[]>();
  for (const item of items) {
    const group = item.group ?? 'Actions';
    const list = groups.get(group) ?? [];
    list.push(item);
    groups.set(group, list);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ij-frame pt-24"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <Command
        className={cn(
          'w-full max-w-lg overflow-hidden rounded-ij-arc border border-ij-seam-raised bg-ij-raised',
          className,
        )}
        style={{ boxShadow: 'var(--ij-popover-shadow)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ij-seam px-3">
          <Command.Input
            placeholder={placeholder}
            className="h-ij-control flex-1 bg-transparent text-ij-ink outline-none placeholder:text-ij-ink-disabled"
          />
          <KbdCombo keys={['⌘', 'K']} size="sm" />
        </div>
        <Command.List className="max-h-80 overflow-auto p-1">
          <Command.Empty className="px-3 py-4 text-ij-ink-info">No results.</Command.Empty>
          {[...groups.entries()].map(([group, groupItems]) => (
            <Command.Group key={group} heading={group} className="px-1 py-1">
              <p className="px-2 py-1 text-ij-island-meta text-ij-ink-info">{group}</p>
              {groupItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  className="flex cursor-default items-center gap-2 rounded-ij-arc px-2 py-1.5 text-ij-ink aria-selected:bg-ij-selection"
                >
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut ? <KbdCombo keys={item.shortcut} size="sm" /> : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
