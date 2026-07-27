'use client';

// SOURCING: AgentRailBlock (CS10). SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH1: rail
// mounts without a composer; artifacts and context feed the inspector.

import type { BlockHost, ObjectSet } from '@commonplace/block-view/types';
import { AgentRailBlock } from '@/components/blocks/AgentRailBlock';
import type { ChatArtifactPayload } from '@/lib/chat/project-types';
import type { ContextEntry } from '@/lib/chat/context-types';

export interface ChatRailProps {
  readonly host: BlockHost;
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly onOpenPlanInCanvas?: () => void;
  readonly artifacts?: readonly ChatArtifactPayload[];
  readonly contextEntries?: readonly ContextEntry[];
}

const EMPTY_SET: ObjectSet = {
  objects: [],
  shape: { types: [], fields: [], relations: [], axes: {}, cardinality: 'empty' },
  subscribe: () => () => {},
};

export function ChatRail({
  host,
  collapsed,
  onToggleCollapse,
  onOpenPlanInCanvas,
  artifacts = [],
  contextEntries = [],
}: ChatRailProps) {
  return (
    <div
      data-chat-rail
      className="h-full min-h-0"
      style={{ width: collapsed ? 32 : 'var(--ij-agent-rail-max-w, 320px)' }}
    >
      <AgentRailBlock
        host={host}
        set={EMPTY_SET}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenPlanInCanvas={onOpenPlanInCanvas}
        artifacts={artifacts}
        contextEntries={contextEntries}
      />
    </div>
  );
}
