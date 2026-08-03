'use client';

// SOURCING: 21st/@jshguo/sidebar-component (via ChatSidebar) + InspectorRail.

import { useState } from 'react';
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
  const host = new ConsoleBlockHost(CONSOLE_VIEW_REGISTRY, {});

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
            className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-ij-island bg-transparent p-6"
          >
            <p className="text-ij-ink" style={{ fontWeight: 'var(--rec-weight-cap)' }}>
              Lifted main island
            </p>
            <p className="mt-2 text-ij-ink-info">
              Left: the 21st/@jshguo sidebar-component (TwoLevelSidebarShell), retokened onto the
              register. Right: the integrated DashboardSidebar (arunjdass 21st nav) with Obsidian
              JSON Canvas as an in-component feature layer (double-click to add a note). The three
              planes read lifted rail, frame panel, sunken editor, straight off Twenty&apos;s
              background ladder.
            </p>
          </main>
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
