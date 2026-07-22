'use client';

// SOURCING: hand-roll. Declared block placeholders (B8): designed empty states
// reserve layout grammar until their dedicated handoffs land.

import type { ViewRenderProps } from '@commonplace/block-view/types';
import { BlockEmptyBody } from './BlockEmptyBody';
import { KanbanBlock } from './KanbanBlock';

export { KanbanBlock };

export function TerminalBlock(_props: ViewRenderProps) {
  return (
    <BlockEmptyBody
      title="Terminal"
      detail="Operate a shell from this block once the desktop path lands. The web console reserves the mount only."
    />
  );
}

export function BrowserPaneBlock(_props: ViewRenderProps) {
  return (
    <BlockEmptyBody
      title="Browser"
      detail="View a page through the Servo render worker (POST /render). Upstream wiring is declared; rendering is a later handoff."
    />
  );
}

export function DocumentBlock(_props: ViewRenderProps) {
  return (
    <BlockEmptyBody
      title="Document"
      detail="Produce a document through pdfx on @react-pdf/renderer. Output mounts here when the pipeline is wired."
    />
  );
}

export function VideoBlock(_props: ViewRenderProps) {
  return (
    <BlockEmptyBody
      title="Video"
      detail="Compose video with Remotion. This block is the composition preview; server-side MP4 render dispatches through the object seam later and returns with a receipt. Rendering is not wired yet."
    />
  );
}

export function CanvasBlock(_props: ViewRenderProps) {
  return (
    <BlockEmptyBody
      title="Canvas"
      detail="Arrange spatially with @xyflow/react and JSON Canvas interchange."
    />
  );
}
