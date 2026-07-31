'use client';

// SOURCING: @commonplace/json-canvas types — the Obsidian JSON Canvas node
// kinds (text/file/link/group) seated on the substrate shell so the inspector
// rail's Z-layer can converge here later (issue 144 A).

import type { CanvasNode } from '@commonplace/json-canvas';
import type { NodeKindEntry } from '../types';

export const JSON_CANVAS_TEXT_KIND = 'jc-text';
export const JSON_CANVAS_FILE_KIND = 'jc-file';
export const JSON_CANVAS_LINK_KIND = 'jc-link';
export const JSON_CANVAS_GROUP_KIND = 'jc-group';

type TextNode = Extract<CanvasNode, { type: 'text' }>;
type FileNode = Extract<CanvasNode, { type: 'file' }>;
type LinkNode = Extract<CanvasNode, { type: 'link' }>;
type GroupNode = Extract<CanvasNode, { type: 'group' }>;

/** Title for a text card: the first non-empty line, which is what a reader scans. */
function textTitle(text: string): string {
  const line = text.split('\n').find((candidate) => candidate.trim().length > 0);
  return line?.trim() ?? 'Note';
}

export const jsonCanvasTextKind: NodeKindEntry<TextNode> = {
  id: JSON_CANVAS_TEXT_KIND,
  palette: 'model',
  shell: (node) => ({
    kindId: JSON_CANVAS_TEXT_KIND,
    title: textTitle(node.text),
  }),
  Body: ({ data }) => (
    <p className="whitespace-pre-wrap break-words text-xs text-ij-ink-info">{data.text}</p>
  ),
};

export const jsonCanvasFileKind: NodeKindEntry<FileNode> = {
  id: JSON_CANVAS_FILE_KIND,
  palette: 'model',
  shell: (node) => ({
    kindId: JSON_CANVAS_FILE_KIND,
    title: node.file.split('/').pop() ?? node.file,
    badges: [{ id: 'path', text: node.file, mono: true, title: node.file }],
  }),
};

export const jsonCanvasLinkKind: NodeKindEntry<LinkNode> = {
  id: JSON_CANVAS_LINK_KIND,
  palette: 'model',
  shell: (node) => ({
    kindId: JSON_CANVAS_LINK_KIND,
    title: node.url,
    badges: [{ id: 'url', text: node.url, mono: true, title: node.url }],
  }),
};

export const jsonCanvasGroupKind: NodeKindEntry<GroupNode> = {
  id: JSON_CANVAS_GROUP_KIND,
  frame: true,
  shell: (node) => ({
    kindId: JSON_CANVAS_GROUP_KIND,
    title: node.label ?? 'Group',
    frame: true,
  }),
};

export const jsonCanvasKinds = [
  jsonCanvasTextKind,
  jsonCanvasFileKind,
  jsonCanvasLinkKind,
  jsonCanvasGroupKind,
] as const;
