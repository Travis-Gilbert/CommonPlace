'use client';

// SOURCING: cmdk for search and keyboard navigation, @dnd-kit/core for the
// affordance drag source. Annotations come from the capability manifest.

import { useDraggable } from '@dnd-kit/core';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import type { PlanCapability } from '@commonplace/theorem-acp/plan-state';

export function ToolPalette({ capabilities }: { capabilities: readonly PlanCapability[] }) {
  return (
    <Command className="flex h-full min-h-0 flex-col bg-ij-chrome text-ij-ink">
      <div className="border-b border-ij-seam p-2">
        <CommandInput
          placeholder="Search affordances"
          aria-label="Search affordances"
          className="h-ij-control w-full rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
        />
      </div>
      <CommandList className="min-h-0 flex-1 overflow-auto p-2">
        <CommandEmpty className="p-2 text-ij-ink-info">No capability matches.</CommandEmpty>
        <CommandGroup heading="Capability manifest">
          {capabilities.map((capability) => (
            <DraggableCapability key={capability.id} capability={capability} />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function DraggableCapability({ capability }: { capability: PlanCapability }) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
  } = useDraggable({
    id: `goal-capability:${capability.id}`,
    data: { capability },
  });
  return (
    <CommandItem
      ref={setNodeRef}
      value={`${capability.title} ${capability.description} ${capability.serverOrigin}`}
      {...attributes}
      {...listeners}
      className="mb-1 grid cursor-grab gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-2 data-[selected=true]:bg-ij-selection"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="flex items-center gap-2">
        <strong className="truncate">{capability.title}</strong>
        <span className="ml-auto font-ij-mono text-ij-ink-info">{capability.serverOrigin}</span>
      </span>
      <span className="line-clamp-2 text-ij-ink-info">{capability.description}</span>
      <span className="flex gap-1">
        <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-1">
          {capability.annotations.readOnly ? 'read-only' : 'writes'}
        </span>
        {capability.annotations.destructive ? (
          <span className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn">destructive</span>
        ) : null}
      </span>
    </CommandItem>
  );
}
