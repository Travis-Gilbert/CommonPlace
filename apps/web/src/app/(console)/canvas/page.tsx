/* Canvas (Commonplaces): the Obsidian JSON Canvas: the spatial workspace.
   Carried over from the harness console, NOT dropped: it lives under the
   Commonplaces tab as part of the workspace. The `.canvas` format (nodes:
   text/file/link/group; edges with sides + labels) renders here in porcelain.
   Renderer wiring (parse `.canvas` JSON → node/edge layout) lands next. */

import { Frame, FileText, Link2, Group, Spline } from 'lucide-react';
import styles from '../surface.module.css';

const NODE_KINDS = [
  { icon: FileText, title: 'Text & file nodes', hint: 'Markdown cards and embedded files pinned to the board.' },
  { icon: Link2, title: 'Link nodes', hint: 'External URLs and internal object references as cards.' },
  { icon: Group, title: 'Groups', hint: 'Labeled regions that cluster related nodes.' },
  { icon: Spline, title: 'Edges', hint: 'Directed connections with sides and labels between nodes.' },
];

export default function CanvasPage() {
  return (
    <>
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">Commonplaces / Canvas</div>
          <h1 className="p-h1">Canvas</h1>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <Frame className={styles.cardIcon} />
              <span className={styles.cardTitle}>JSON Canvas workspace</span>
            </div>
            <p className={styles.cardHint}>
              The Obsidian <code>.canvas</code> open format is carried over from the harness console
              as part of the workspace. The board renderer (pan/zoom, node cards, edge routing) binds
              here next; the file is the source of truth.
            </p>
            <span className={styles.soon}>Renderer wiring next</span>
          </div>
          {NODE_KINDS.map(({ icon: Icon, title, hint }) => (
            <div className={styles.card} key={title}>
              <div className={styles.cardHead}>
                <Icon className={styles.cardIcon} />
                <span className={styles.cardTitle}>{title}</span>
              </div>
              <p className={styles.cardHint}>{hint}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
