// SOURCING: hand-roll. Maps BlockPresentation.kindGlyph to shell icons.

import type { BlockKindGlyph } from '@commonplace/block-view/types';
import type { ReactNode } from 'react';
import {
  IconCards,
  IconDoc,
  IconInspector,
  IconMemory,
  IconModel,
  IconRail,
  IconRecords,
  IconRun,
  IconSearch,
  IconThread,
  IconWorkspace,
} from '@/components/shell/icons';

const SIZE = 16;

/** Resolve a presentation kindGlyph key to the matching shell icon. */
export function kindGlyphNode(kind: BlockKindGlyph | undefined): ReactNode {
  switch (kind) {
    case 'cards':
      return <IconCards size={SIZE} />;
    case 'canvas':
      return <IconCards size={SIZE} />;
    case 'thread':
      return <IconThread size={SIZE} />;
    case 'doc':
      return <IconDoc size={SIZE} />;
    case 'memory':
      return <IconMemory size={SIZE} />;
    case 'rail':
      return <IconRail size={SIZE} />;
    case 'workspace':
      return <IconWorkspace size={SIZE} />;
    case 'model':
      return <IconModel size={SIZE} />;
    case 'files':
      return <IconDoc size={SIZE} />;
    case 'context':
      return <IconInspector size={SIZE} />;
    case 'terminal':
      return <IconRun size={SIZE} />;
    case 'browser':
      return <IconSearch size={SIZE} />;
    case 'kanban':
      return <IconCards size={SIZE} />;
    case 'automation':
      return <IconRun size={SIZE} />;
    case 'records':
    default:
      return <IconRecords size={SIZE} />;
  }
}

export function skeletonForKind(
  kind: BlockKindGlyph | undefined,
): 'rows' | 'cards' | 'blank' {
  if (kind === 'cards') return 'cards';
  return 'rows';
}
