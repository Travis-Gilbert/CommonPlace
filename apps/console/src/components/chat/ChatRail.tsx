'use client';

// SOURCING: AgentRailBlock (CS10). CH6 mounts the existing rail directly; no
// new rail component. Collapse state is controlled by the chat page and
// persists per thread.

import type { BlockHost, ObjectSet } from '@commonplace/block-view/types';
import { AgentRailBlock } from '@/components/blocks/AgentRailBlock';

export interface ChatRailProps {
  readonly host: BlockHost;
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly onOpenPlanInCanvas?: () => void;
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
      />
    </div>
  );
}
