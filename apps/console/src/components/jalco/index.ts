// SOURCING: @jalco registry barrel. Re-exports CLI-installed jal-co/ui
// components (SPEC-CONSOLE-COMPONENT-SOURCING-1.0 SC1). Hand-extracted
// copies under this folder are retired; imports keep the `@/components/jalco`
// path as the console-facing namespace.

export { Kbd, KbdCombo, type KbdProps, type KbdComboProps } from '@/components/kbd';
export {
  StatusIndicator,
  type Status,
  type StatusIndicatorProps,
} from '@/components/status-indicator';
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
export { JsonViewer, type JsonViewerProps } from '@/components/json-viewer';
export {
  CommitGraph,
  type CommitGraphCommit,
  type CommitGraphProps,
} from './commit-graph';
