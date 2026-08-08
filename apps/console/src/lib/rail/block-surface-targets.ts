// SOURCING: none. Maps Blocks palette rows to page-owned surfaces so sidebar
// clicks navigate instead of dumping view-instances into the center island.

import { SURFACE_ROUTES } from '@/lib/surface-routes';
import type { BlockPaletteItem } from '@/lib/rail/rail-model';

export type BlockSurfaceTarget = {
  readonly path: string;
  readonly surfaceId: string;
};

/**
 * Descriptor id and palette kind → durable surface. Prefer explicit rows over
 * guessing from kind glyphs so Blocks never reopen as editor tabs.
 */
const BY_DESCRIPTOR_ID: Readonly<Record<string, BlockSurfaceTarget>> = {
  'record.table': { path: '/records', surfaceId: 'console-records' },
  'cards.grid': { path: '/cards', surfaceId: 'console-cards' },
  'markdown.doc': { path: '/documents', surfaceId: 'console-docs' },
  'doc.list': { path: '/documents', surfaceId: 'console-docs' },
  'files.tree': { path: '/files', surfaceId: 'console-files' },
  'index.rail': { path: '/filing', surfaceId: 'console-index' },
  'index.stream': { path: '/filing', surfaceId: 'console-index' },
  'index.rules': { path: '/filing', surfaceId: 'console-index' },
  'automation.history': { path: '/automation', surfaceId: 'console-automation' },
  'goal.stack': { path: '/goals', surfaceId: 'console-goals' },
  'program.canvas': { path: '/program', surfaceId: 'console-program' },
  canvas: { path: '/canvas', surfaceId: 'console-canvas' },
  'search.stack': { path: '/search', surfaceId: 'console-search' },
  kanban: { path: '/kanban', surfaceId: 'console-kanban' },
  'commands.gallery': { path: '/commands', surfaceId: 'console-commands' },
  'model.studio': { path: '/Data-model', surfaceId: 'console-models' },
  'model.settings': { path: '/Data-model/settings', surfaceId: 'console-model-settings' },
  'workspace.substrate': { path: '/workspace', surfaceId: 'console-workspace' },
};

const BY_PALETTE_KIND: Readonly<Record<string, BlockSurfaceTarget>> = {
  records: { path: '/records', surfaceId: 'console-records' },
  cards: { path: '/cards', surfaceId: 'console-cards' },
  doc: { path: '/documents', surfaceId: 'console-docs' },
  documents: { path: '/documents', surfaceId: 'console-docs' },
  files: { path: '/files', surfaceId: 'console-files' },
  index: { path: '/filing', surfaceId: 'console-index' },
  automation: { path: '/automation', surfaceId: 'console-automation' },
  plan: { path: '/goals', surfaceId: 'console-goals' },
  canvas: { path: '/canvas', surfaceId: 'console-canvas' },
  program: { path: '/program', surfaceId: 'console-program' },
  search: { path: '/search', surfaceId: 'console-search' },
  kanban: { path: '/kanban', surfaceId: 'console-kanban' },
  commands: { path: '/commands', surfaceId: 'console-commands' },
  model: { path: '/Data-model', surfaceId: 'console-models' },
  workspace: { path: '/workspace', surfaceId: 'console-workspace' },
};

/** Resolve a Blocks palette item to a page-owned surface, or null if embed-only. */
export function resolveBlockSurfaceTarget(
  item: Pick<BlockPaletteItem, 'descriptorId' | 'kind' | 'id'>,
): BlockSurfaceTarget | null {
  const byDescriptor = BY_DESCRIPTOR_ID[item.descriptorId];
  if (byDescriptor) return byDescriptor;
  const byKind = BY_PALETTE_KIND[item.kind] ?? BY_PALETTE_KIND[item.id];
  if (byKind) return byKind;
  // Last resort: any SURFACE_ROUTES entry whose path basename matches the id.
  const route = SURFACE_ROUTES.find(
    (entry) =>
      entry.path === `/${item.id}` ||
      entry.path === `/${item.kind}` ||
      entry.surfaceId === `console-${item.id}` ||
      entry.surfaceId === `console-${item.kind}`,
  );
  return route
    ? { path: route.path, surfaceId: route.surfaceId }
    : null;
}
