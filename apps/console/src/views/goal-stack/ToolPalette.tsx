'use client';

// SOURCING: cmdk for search and keyboard navigation, @dnd-kit/core for the
// affordance drag source. Four palette groups per SPEC Plan Canvas F2.

import { useDraggable } from '@dnd-kit/core';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { groupPalette, type PlanCapability, type PaletteGroup } from '@commonplace/theorem-acp/plan-state';

const GROUP_LABELS: Record<PaletteGroup, string> = {
  affordances: 'Harness affordances',
  connectors: 'Connectors',
  plugin_tools: 'Plugin tools',
  skills: 'Skills',
};

export function ToolPalette({ capabilities }: { capabilities: readonly PlanCapability[] }) {
  const groups = groupPalette(capabilities);
  return (
    <Command className="flex h-full min-h-0 flex-col bg-ij-chrome text-ij-ink">
      <div className="border-b border-ij-seam p-2">
        <CommandInput
          placeholder="Search palette"
          aria-label="Search palette"
          className="h-ij-control w-full rounded-ij-arc border border-ij-control-border bg-ij-editor px-2 focus:outline-2 focus:outline-ij-accent"
        />
      </div>
      <CommandList className="min-h-0 flex-1 overflow-auto p-2">
        <CommandEmpty className="p-2 text-ij-ink-info">No palette entry matches.</CommandEmpty>
        {(Object.keys(GROUP_LABELS) as PaletteGroup[]).map((group) => (
          groups[group].length ? (
            <CommandGroup key={group} heading={GROUP_LABELS[group]} data-palette-group={group}>
              {groups[group].map((capability) => (
                <DraggableCapability key={capability.id} capability={capability} />
              ))}
            </CommandGroup>
          ) : null
        ))}
      </CommandList>
    </Command>
  );
}

function DraggableCapability({ capability }: { capability: PlanCapability }) {
  const locked = capability.grantState === 'locked';
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
      value={`${capability.title} ${capability.description} ${capability.serverOrigin} ${capability.group}`}
      {...attributes}
      {...listeners}
      data-plan-capability={capability.id}
      data-grant={capability.grantState}
      className="mb-1 grid cursor-grab gap-1 rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-2 data-[selected=true]:bg-ij-selection"
      style={{ opacity: isDragging ? 0.4 : locked ? 0.72 : 1 }}
    >
      <span className="flex items-center gap-2">
        <strong className="truncate">{capability.title}</strong>
        <span className="ml-auto font-ij-mono text-ij-ink-info">{capability.serverOrigin}</span>
      </span>
      <span className="line-clamp-2 text-ij-ink-info">{capability.description}</span>
      <span className="flex flex-wrap gap-1">
        <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-1">
          {capability.annotations.readOnly ? 'read-only' : 'writes'}
        </span>
        {capability.annotations.destructive ? (
          <span className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn">destructive</span>
        ) : null}
        {locked ? (
          <span className="rounded-ij-arc-underline bg-ij-warn-bg px-1 text-ij-warn">
            locked: {capability.missingCapability ?? 'missing grant'}
          </span>
        ) : (
          <span className="rounded-ij-arc-underline bg-ij-selection-inactive px-1">granted</span>
        )}
      </span>
    </CommandItem>
  );
}
