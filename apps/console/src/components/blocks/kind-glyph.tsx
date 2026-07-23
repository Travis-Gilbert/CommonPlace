// SOURCING: hand-roll. Maps BlockPresentation.kindGlyph to shell icons.
// Kind hue from SPEC-MATERIAL-REGISTER-1.0 D4 (glyph + edge marker only).

import type { BlockKindGlyph } from '@commonplace/block-view/types';
import type { CSSProperties, ReactNode } from 'react';
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
import { kindHueCss } from '@/lib/material/kind-hues';

const SIZE = 16;

/** Resolve a presentation kindGlyph key to the matching shell icon. */
export function kindGlyphNode(kind: BlockKindGlyph | undefined): ReactNode {
  const color = kindHueCss(kind);
  const style: CSSProperties = { color };
  switch (kind) {
    case 'cards':
      return <IconCards size={SIZE} style={style} />;
    case 'canvas':
      return <IconCards size={SIZE} style={style} />;
    case 'thread':
      return <IconThread size={SIZE} style={style} />;
    case 'doc':
      return <IconDoc size={SIZE} style={style} />;
    case 'memory':
      return <IconMemory size={SIZE} style={style} />;
    case 'rail':
      return <IconRail size={SIZE} style={style} />;
    case 'workspace':
      return <IconWorkspace size={SIZE} style={style} />;
    case 'model':
      return <IconModel size={SIZE} style={style} />;
    case 'files':
      return <IconDoc size={SIZE} style={style} />;
    case 'context':
      return <IconInspector size={SIZE} style={style} />;
    case 'terminal':
      return <IconRun size={SIZE} style={style} />;
    case 'browser':
      return <IconSearch size={SIZE} style={style} />;
    case 'kanban':
      return <IconCards size={SIZE} style={style} />;
    case 'automation':
      return <IconRun size={SIZE} style={style} />;
    case 'records':
    default:
      return <IconRecords size={SIZE} style={style} />;
  }
}

/** Short edge marker color for kind (never a surface fill). */
export function kindEdgeStyle(kind: BlockKindGlyph | undefined): CSSProperties {
  return {
    borderLeft: `2px solid ${kindHueCss(kind)}`,
  };
}

export function skeletonForKind(
  kind: BlockKindGlyph | undefined,
): 'rows' | 'cards' | 'blank' {
  if (kind === 'cards') return 'cards';
  return 'rows';
}
