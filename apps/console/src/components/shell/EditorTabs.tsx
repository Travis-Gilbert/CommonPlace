'use client';

// SOURCING: hand-roll. The Int UI editor tab strip is a named chrome
// signature (gray-1 strip, 0.75 unselected alpha, 4px accent underline with
// 4px arc); no library models the Int UI tab contract. Tabs host view
// instances; the active tab persists on the region object through the host.

import type { BlockHost, ObjectRef } from '@commonplace/block-view/types';
import { motion } from 'motion/react';
import { seconds, useMotionDurations, EASE_OUT } from '@/motion/motion-tokens';
import { ViewInstanceHost } from './ViewInstanceHost';
import { KindDot, type ObjectKind } from './icons';

function kindOf(instance: ObjectRef): ObjectKind {
  const descriptor = String(instance.properties.descriptor_id ?? '');
  if (descriptor === 'markdown.doc') return 'doc';
  if (descriptor === 'code.file') return 'code';
  if (descriptor === 'chat.thread') return 'thread';
  if (descriptor === 'settings.appearance') return 'settings';
  return 'record';
}

interface EditorTabsProps {
  readonly region: ObjectRef;
  readonly instances: readonly ObjectRef[];
  readonly host: BlockHost;
}

export function EditorTabs({ region, instances, host }: EditorTabsProps) {
  const durations = useMotionDurations();
  const activeId = String(region.properties.active_tab ?? instances[0]?.id ?? '');
  const active = instances.find((instance) => instance.id === activeId) ?? instances[0];
  const bare = region.properties.chrome === 'bare' && instances.length === 1;

  const activate = (id: string) => {
    void host.emit({ kind: 'update', id: region.id, patch: { active_tab: id } });
  };

  // Editor island: one SDF rect; MaterialLayer measures the tab strip height
  // and paints that band as chrome, then the lighter well below.
  return (
    <div
      data-editor-island
      data-island="editor"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-ij-island bg-transparent"
    >
      {bare ? null : <div
        role="tablist"
        aria-label="Editor tabs"
        data-editor-tab-strip
        data-paint-region="tab-strip"
        className="flex h-ij-tab shrink-0 items-end border-b border-ij-seam bg-transparent"
      >
        {instances.map((instance) => {
          const selected = instance.id === active?.id;
          return (
            <button
              key={instance.id}
              role="tab"
              aria-selected={selected}
              onClick={() => activate(instance.id)}
              className="relative flex h-full items-center gap-2 px-4 text-ij-ink"
              style={{
                opacity: selected ? 1 : 0.75,
                background: selected ? 'var(--ij-editor)' : 'transparent',
                transition: 'var(--rec-clickable-transition)',
              }}
            >
              <KindDot kind={kindOf(instance)} />
              {String(instance.properties.title ?? instance.id)}
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 bottom-0 h-ij-underline rounded-ij-arc-underline bg-ij-accent"
                />
              ) : null}
            </button>
          );
        })}
      </div>}
      <div data-editor-well data-paint-region="editor-well" className="min-h-0 flex-1 bg-transparent">
        {active ? (
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: seconds(durations.fast), ease: EASE_OUT }}
            className="h-full"
          >
            <ViewInstanceHost instance={active} host={host} />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
