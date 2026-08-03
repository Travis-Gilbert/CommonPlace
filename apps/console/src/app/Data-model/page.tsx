// SOURCING: none. Canonical App Router segment for the Data model surface.
// Server-stamp the register impl so the cutover doctor can observe it without
// waiting for client hydration of ModelView / ForkDiagramCanvas.

import ConsoleSurfacePage from '@/lib/console-surface-page';

export default async function DataModelPage() {
  return (
    <div className="h-full min-h-0" data-register-impl="model-canvas.owox">
      <ConsoleSurfacePage />
    </div>
  );
}
