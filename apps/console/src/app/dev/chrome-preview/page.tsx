'use client';

// SOURCING: 21st/@jshguo/sidebar-component (via ChatSidebar) + InspectorRail.

import { useMemo, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { MaterialLayer } from '@/components/ground/MaterialLayer';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import {
  CHAT_INSPECTOR_SECTIONS,
  InspectorRail,
} from '@/components/shell/InspectorRail';
import { ConsoleBlockHost } from '@/lib/console-host';
import { CONSOLE_VIEW_REGISTRY } from '@/views/registry';
import type { ChatCatalog } from '@/lib/chat/project-types';

const catalog: ChatCatalog = {
  activeProjectId: 'proj-default',
  projects: [
    {
      id: 'proj-default',
      name: 'Default project',
      description: 'Preview',
      documentIds: [],
      objectTypes: [],
      updatedAt: 0,
    },
  ],
  threads: [
    {
      id: 'thread-1',
      projectId: 'proj-default',
      title: 'Preview thread',
      sessionId: null,
      sessionResumable: false,
      capability: null,
      railCollapsed: true,
      updatedAt: 0,
      scrollTop: 0,
      messages: [],
    },
  ],
};

export default function ChromePreviewPage() {
  const [inspectorOpen, setInspectorOpen] = useState(true);
  // Stable host identity — recreating each render cancels JsonCanvasLayer boot
  // before hydrated=true, so double-click create never arms.
  const host = useMemo(
    () => new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {}),
    [],
  );

  return (
    <SessionProvider>
      <div className="relative h-dvh w-full overflow-hidden bg-ij-frame" data-chat-page>
        <MaterialLayer />
        <div className="relative z-10 flex h-full min-h-0">
          <ChatSidebar
            catalog={catalog}
            activeThreadId="thread-1"
            capabilities={[]}
            onCatalogChange={() => {}}
            onOpenThread={() => {}}
            surface="chat"
          />
          <main
            data-island="editor"
            data-block-size="w"
            className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-ij-island bg-transparent"
            aria-label="Main island"
          />
          <InspectorRail
            host={host}
            open={inspectorOpen}
            onOpenChange={setInspectorOpen}
            sections={CHAT_INSPECTOR_SECTIONS}
            workspaceName="Default project"
          />
        </div>
      </div>
    </SessionProvider>
  );
}
