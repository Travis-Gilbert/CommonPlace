'use client';

// Dev preview surface for the recreated ReUI kanban-board-5 block
// (keenthemes/reui c-kanban-5), register-skinned. Not a registered surface:
// previews live under /dev and never reach the palette.

import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { KanbanBoard5 } from '@/components/ui/kanban-board-5';

export default function KanbanBoard5PreviewPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ij-frame" data-kanban-board-5-preview>
      <MaterialLayer />
      <main className="relative z-10 flex h-full min-h-0 flex-col gap-4 overflow-auto p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-sm font-medium text-ij-ink">Kanban Board 5</h1>
          <p className="text-xs text-ij-ink-info">
            Workflow status board from keenthemes/reui, recreated on the local
            ui/kanban primitive. Drag cards within and across columns; columns
            hold status dots, counts, progress, and votes.
          </p>
        </header>
        <KanbanBoard5 />
      </main>
    </div>
  );
}
