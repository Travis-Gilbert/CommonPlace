'use client';

// SOURCING: cmdk view switcher grammar (Twenty "ViewName · count" header).
// ViewBar names the active lens and exposes save-as when the host provides views.

import { useMemo, useState } from 'react';
import type { ViewMetadata } from '@commonplace/data-model-contracts';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ViewPresenceActor } from './presence';
import { RecordChip } from './RecordChip';

export interface ViewBarProps {
  readonly views: readonly ViewMetadata[];
  readonly activeViewId?: string;
  readonly count: number;
  readonly onSelectView: (viewId: string) => void;
  readonly onSaveAs?: () => void;
  /** Live actors on this view (humans and heads). Nothing simulated. */
  readonly presence?: readonly ViewPresenceActor[];
}

export function ViewBar({
  views,
  activeViewId,
  count,
  onSelectView,
  onSaveAs,
  presence = [],
}: ViewBarProps) {
  const [open, setOpen] = useState(false);
  const activeView = useMemo(
    () => views.find((view) => view.id === activeViewId) ?? views[0],
    [activeViewId, views],
  );
  const presenceActors = useMemo(() => {
    const byId = new Map<string, ViewPresenceActor>();
    for (const actor of presence) byId.set(actor.actorId, actor);
    return [...byId.values()];
  }, [presence]);

  if (views.length === 0) return null;

  const title = activeView?.label ?? 'All';

  return (
    <div className="flex h-ij-toolbar shrink-0 items-center gap-2 border-b border-ij-seam px-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-ij-control px-2 font-medium text-ij-ink">
            {title}
            <span className="text-ij-ink-info"> · {count}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Switch view" />
            <CommandList>
              <CommandEmpty>No views found.</CommandEmpty>
              <CommandGroup heading="Views">
                {views.map((view) => (
                  <CommandItem
                    key={view.id}
                    value={view.label}
                    onSelect={() => {
                      onSelectView(view.id);
                      setOpen(false);
                    }}
                  >
                    {view.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {presenceActors.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto" data-view-presence>
          {presenceActors.map((actor) => (
            <RecordChip
              key={actor.actorId}
              label={`${actor.actorKind === 'head' ? 'head' : 'human'}:${actor.actorId}`}
            />
          ))}
        </div>
      ) : null}
      {onSaveAs ? (
        <Button variant="outline" size="sm" className="ml-auto h-ij-control" onClick={onSaveAs}>
          Save as
        </Button>
      ) : null}
    </div>
  );
}
