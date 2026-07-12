'use client';

/**
 * Brand asset extraction for the Presence mark (SPEC-UI-SOURCING-ADDENDUM,
 * Presence D3). Renders each static reduced-motion constellation from the SAME
 * state definitions the product mark uses (presenceStates.ts) and saves it via
 * textmode.export.js as SVG and PNG.
 *
 * Developer-invoked only (from a devtools console or a script); this module is
 * not mounted anywhere a user can reach, per the no-fake-UI rule. Usage:
 *
 *   import { exportPresenceGlyphs } from '@/components/commonplace/presence/presenceExport';
 *   await exportPresenceGlyphs();   // downloads presence-<state>.svg and .png
 */

import {
  constellationFor,
  PRESENCE_GLYPHS,
  PRESENCE_GOLD,
  PRESENCE_STATES,
  type PresenceState,
} from './presenceStates';

const EXPORT_SIZE = 256;
const EXPORT_FONT_SIZE = 24;

export async function exportPresenceGlyphs(
  states: readonly PresenceState[] = PRESENCE_STATES,
): Promise<void> {
  const [{ textmode }, { ExportPlugin }] = await Promise.all([
    import('textmode.js'),
    import('textmode.export.js'),
  ]);

  for (const state of states) {
    const t = textmode.create({
      width: EXPORT_SIZE,
      height: EXPORT_SIZE,
      fontSize: EXPORT_FONT_SIZE,
      frameRate: 1,
      seed: 'presence-mark',
      plugins: [ExportPlugin],
    });
    try {
      const grid = t.grid;
      const radius = grid ? Math.floor(Math.min(grid.cols, grid.rows) / 2) - 1 : 4;
      await new Promise<void>((resolve) => {
        let saved = false;
        t.draw(() => {
          t.background(0, 0);
          for (const glyph of constellationFor(state, radius)) {
            t.push();
            t.translate(glyph.x, glyph.y);
            t.charColor(
              PRESENCE_GOLD[0],
              PRESENCE_GOLD[1],
              PRESENCE_GOLD[2],
              Math.round(glyph.ink * 255),
            );
            t.char(PRESENCE_GLYPHS[glyph.glyph]);
            t.point();
            t.pop();
          }
          if (!saved) {
            saved = true;
            t.saveSVG({ filename: `presence-${state}` });
            void t.saveCanvas({ format: 'png', filename: `presence-${state}` });
            resolve();
          }
        });
        t.redraw(1);
      });
    } finally {
      t.destroy();
    }
  }
}
