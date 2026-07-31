// SOURCING: none — ComfyUI's titled group frame, read-and-reimplemented.
//
// A frame is a titled region. Its membership is geometry and lives in the
// layout document (see layout/document.ts `frameMembership`); nothing about a
// frame ever reaches content identity, so deleting every frame on a canvas
// changes how it reads and not what it means.

import type { NodeKindEntry } from '../types';

export const GROUP_FRAME_KIND = 'group-frame';

export interface GroupFrameData {
  readonly title: string;
}

export const groupFrameKind: NodeKindEntry<GroupFrameData> = {
  id: GROUP_FRAME_KIND,
  frame: true,
  shell: (data) => ({
    kindId: GROUP_FRAME_KIND,
    title: data.title,
    frame: true,
  }),
};
