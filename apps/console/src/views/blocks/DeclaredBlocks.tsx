'use client';

// SOURCING: hand-roll. Declared block placeholders (B8): designed empty states
// reserve layout grammar until their dedicated handoffs land.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { IslandEmptyBody } from './IslandEmptyBody';

export function TerminalBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Terminal"
      detail="Operate a shell from this island once the desktop path lands. The web console reserves the mount only."
    />
  );
}

export function BrowserPaneBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Browser"
      detail="View a page through the Servo render worker (POST /render). Upstream wiring is declared; rendering is a later handoff."
    />
  );
}

export function KanbanBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Kanban"
      detail="Move work through states. Cards and columns will bind to dnd-kit on the object seam."
    />
  );
}

export function DocumentBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Document"
      detail="Produce a document through pdfx on @react-pdf/renderer. Output mounts here when the pipeline is wired."
    />
  );
}

export function VideoBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Video"
      detail="Compose video with Remotion. This island is the composition preview; server-side MP4 render dispatches through the object seam later and returns with a receipt. Rendering is not wired yet."
    />
  );
}

export function CanvasBlock(_props: ViewRenderProps) {
  return (
    <IslandEmptyBody
      title="Canvas"
      detail="Arrange spatially with @xyflow/react and JSON Canvas interchange."
    />
  );
}
