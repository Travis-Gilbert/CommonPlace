'use client';

// SOURCING: fork of Build UI / 21st.dev @builduilabs filesystem-item
// (buildui.com/recipes/recursive-filetree). Not an npm package.
// Actual API recorded for SPEC-COMMONPLACE-CHAT-SHELL-1.2 SH7:
//   type Node = { name: string; nodes?: Node[] }
//   FilesystemItem({ node, animated? }: { node: Node; animated?: boolean })
// Folders are nodes with `nodes` (possibly empty); leaves omit `nodes`.
// Icon sets from the reference are not adopted (Noun set stays canonical).
// Extended here with optional id, unavailable, included, provenance, and
// leaf include/exclude actions for graph-object context.

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IconChevronDown, IconDoc, IconFiles } from '@/components/shell/icons';
import { cn } from '@/lib/cn';
import { seconds, useMotionDurations } from '@/motion/motion-tokens';

export type FilesystemNode = {
  readonly name: string;
  readonly nodes?: readonly FilesystemNode[];
  readonly id?: string;
  /** When true, the source is unreachable: render unavailable, never empty. */
  readonly unavailable?: boolean;
  readonly included?: boolean;
  readonly provenance?: string;
  readonly onToggleInclude?: () => void;
};

export type FilesystemItemProps = {
  readonly node: FilesystemNode;
  readonly animated?: boolean;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={cn('inline-flex text-ij-ink-info transition-transform', open && 'rotate-90')}
      style={{ transitionDuration: 'var(--rec-clickable-transition)' }}
      aria-hidden
    >
      <IconChevronDown size={14} className="-rotate-90" />
    </span>
  );
}

function RowChrome({
  node,
  isFolder,
  open,
  onToggle,
  trailing,
}: {
  node: FilesystemNode;
  isFolder: boolean;
  open: boolean;
  onToggle?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 py-1 text-ij-ink">
      {isFolder && (node.nodes?.length ?? 0) > 0 ? (
        <button
          type="button"
          onClick={onToggle}
          className="p-1 -m-1 text-ij-ink-info hover:text-ij-ink"
          aria-expanded={open}
          aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
        >
          <Chevron open={open} />
        </button>
      ) : (
        <span className="inline-block shrink-0" style={{ width: 'var(--ij-chat-fs-indent)' }} aria-hidden />
      )}
      {isFolder ? (
        <IconFiles size={16} className="shrink-0 text-ij-ink-info" />
      ) : (
        <IconDoc size={16} className="shrink-0 text-ij-ink-info" />
      )}
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {node.provenance ? (
        <span
          className="shrink-0 text-ij-ink-disabled"
          style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
        >
          {node.provenance}
        </span>
      ) : null}
      {node.unavailable ? (
        <span
          className="shrink-0 text-ij-ink-info"
          style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
        >
          unavailable
        </span>
      ) : null}
      {trailing}
    </span>
  );
}

export function FilesystemItem({ node, animated = false }: FilesystemItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const durations = useMotionDurations();
  const isFolder = Array.isArray(node.nodes);
  const children = node.nodes ?? [];

  const trailing =
    !isFolder && node.onToggleInclude && !node.unavailable ? (
      <button
        type="button"
        className="shrink-0 rounded-[var(--radius-control)] px-1.5 py-0.5 text-ij-ink-info hover:bg-ij-hover-surface hover:text-ij-ink"
        style={{ fontSize: 'var(--ij-composer-meta-font-size)' }}
        onClick={node.onToggleInclude}
      >
        {node.included === false ? 'Include' : 'Exclude'}
      </button>
    ) : null;

  if (node.unavailable && isFolder) {
    return (
      <li data-fs-unavailable>
        <RowChrome node={node} isFolder open={false} trailing={trailing} />
      </li>
    );
  }

  const childList = (
    <ul className="flex flex-col justify-end overflow-hidden pl-4">
      {children.map((child) => (
        <FilesystemItem
          node={child}
          key={child.id ?? child.name}
          animated={animated}
        />
      ))}
    </ul>
  );

  return (
    <li data-fs-node={isFolder ? 'folder' : 'leaf'}>
      <RowChrome
        node={node}
        isFolder={isFolder}
        open={isOpen}
        onToggle={() => setIsOpen((value) => !value)}
        trailing={trailing}
      />
      {animated ? (
        <AnimatePresence initial={false}>
          {isOpen && isFolder ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: seconds(durations.fast), ease: 'easeOut' }}
              className="overflow-hidden"
            >
              {childList}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        isOpen && isFolder ? childList : null
      )}
    </li>
  );
}
