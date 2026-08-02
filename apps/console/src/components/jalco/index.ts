// SOURCING: @jalco registry barrel. Re-exports CLI-installed jal-co/ui
// components (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC1). Hand-extracted
// copies under this folder are retired; imports keep the `@/components/jalco`
// path as the console-facing namespace.

export { Kbd, KbdCombo, type KbdProps, type KbdComboProps } from '@/components/kbd';
// The hand-rolled status pill is deleted; twenty-ui `Status` (fork) carries the
// state pill now. Import it from 'twenty-ui/data-display' (TU5).
export {
  LogViewerTerminal as LogViewer,
  LogViewerMinimal,
  LogViewerFilterable,
  type LogEntry,
  type LogLevel,
  type LogViewerTerminalProps as LogViewerProps,
} from '@/components/log-viewer';
export { DiffViewer } from '@/components/diff-viewer';
export {
  FileTree,
  type FileTreeNode,
} from '@/components/file-tree';
// The shiki-themed JSON viewer is deleted; twenty-ui json-visualizer (fork)
// carries every JSON surface through '@/components/receipt-json' (TU6).
export {
  CommitGraph,
  type CommitGraphCommit,
  type CommitGraphProps,
} from './commit-graph';
