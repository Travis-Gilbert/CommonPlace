// SOURCING: keenthemes/reui kanban-board-5 block
// (registry-reui/bases/base/components/kanban/c-kanban-5.tsx), structure,
// behavior, and fixture data ported onto the local ui/kanban primitive
// (@base-ui/react + dnd-kit, the same primitives layer the twenty-ui fork
// uses). Twenty components where they fit: ProgressBar from twenty-ui/feedback
// (--t-* themed from the register), Pill from twenty-ui/data-display, and
// Tabler icons via twenty-ui/icon. Column wells and cards resolve to the
// register bridge.
'use client';

import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pill } from 'twenty-ui/data-display';
import { ProgressBar } from 'twenty-ui/feedback';
import { IconArrowUp } from 'twenty-ui/icon';
import { cn } from '@/lib/utils';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from '@/components/ui/kanban';

interface Feature {
  id: string;
  title: string;
  description: string;
  progress: number;
  votes: number;
}

const COLUMNS: Record<string, { title: string; dotClass: string }> = {
  planned: { title: 'Planned', dotClass: 'bg-ij-link' },
  building: { title: 'Building', dotClass: 'bg-ij-warn' },
  testing: { title: 'Testing', dotClass: 'bg-ij-room' },
  shipped: { title: 'Shipped', dotClass: 'bg-ij-ok' },
};

function FeatureCard({
  feature,
  asHandle,
  ...props
}: { feature: Feature; asHandle?: boolean } & Omit<
  ComponentProps<typeof KanbanItem>,
  'value' | 'children'
>) {
  const content = (
    <div className="flex flex-col gap-2.5 rounded-ij-arc border border-ij-seam bg-ij-raised p-3">
      <span className="text-sm font-medium text-ij-ink">{feature.title}</span>
      <p className="line-clamp-2 text-xs text-ij-ink-info">
        {feature.description}
      </p>
      <ProgressBar
        value={feature.progress}
        barColor="var(--ij-progress)"
        withBorderRadius
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] tabular-nums text-ij-ink-info">
          {feature.progress}% complete
        </span>
        <div className="flex items-center gap-1">
          <IconArrowUp size={12} className="text-ij-ink-info" />
          <span className="text-xs tabular-nums text-ij-ink-info">
            {feature.votes}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <KanbanItem value={feature.id} {...props}>
      {asHandle ? (
        <KanbanItemHandle className="rounded-ij-arc">{content}</KanbanItemHandle>
      ) : (
        content
      )}
    </KanbanItem>
  );
}

export function KanbanBoard5() {
  const [columns, setColumns] = useState<Record<string, Feature[]>>({
    planned: [
      {
        id: 'f1',
        title: 'AI-powered search',
        description: 'Natural language search across all content',
        progress: 0,
        votes: 142,
      },
      {
        id: 'f2',
        title: 'Custom webhooks',
        description: 'User-configurable webhook endpoints',
        progress: 0,
        votes: 98,
      },
    ],
    building: [
      {
        id: 'f3',
        title: 'Real-time collaboration',
        description: 'Multi-user editing with presence indicators',
        progress: 65,
        votes: 234,
      },
      {
        id: 'f4',
        title: 'API v2 migration',
        description: 'RESTful API with OpenAPI 3.0 spec',
        progress: 40,
        votes: 176,
      },
    ],
    shipped: [
      {
        id: 'f6',
        title: 'Dark mode',
        description: 'System-aware theme with manual override',
        progress: 100,
        votes: 456,
      },
      {
        id: 'f7',
        title: 'Export to CSV',
        description: 'Bulk data export with custom fields',
        progress: 100,
        votes: 189,
      },
    ],
  });

  return (
    <Kanban
      value={columns}
      onValueChange={setColumns}
      getItemValue={(item) => item.id}
    >
      <KanbanBoard className="grid grid-cols-3">
        {Object.entries(columns).map(([colId, features]) => {
          const col = COLUMNS[colId];
          return (
            <KanbanColumn key={colId} value={colId} className="min-h-0">
              <div className="flex h-full flex-col gap-2 rounded-ij-arc border border-ij-seam bg-ij-hover-surface/50 p-2.5">
                <header className="flex flex-row items-center gap-2">
                  <div className={cn('size-2 rounded-full', col.dotClass)} />
                  <span className="text-sm font-medium capitalize text-ij-ink">
                    {col.title}
                  </span>
                  <Pill label={String(features.length)} className="ml-auto" />
                </header>
                <KanbanColumnContent
                  value={colId}
                  className="flex flex-col gap-2 p-0.5"
                >
                  {features.map((feature) => (
                    <FeatureCard key={feature.id} feature={feature} asHandle />
                  ))}
                </KanbanColumnContent>
              </div>
            </KanbanColumn>
          );
        })}
      </KanbanBoard>
      <KanbanOverlay className="rounded-md border-2 border-dashed border-ij-seam-raised bg-ij-hover-surface/50" />
    </Kanban>
  );
}
