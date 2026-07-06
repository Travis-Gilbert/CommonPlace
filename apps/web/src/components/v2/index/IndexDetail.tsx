'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Link2,
  Mic,
  SquareCheck,
  CircleHelp,
  TriangleAlert,
  CalendarClock,
  NotebookPen,
} from 'lucide-react';
import type { IndexRow, IndexRowDestination, IndexRowKind } from '@/lib/commonplace/index-queries';
import styles from './index.module.css';

/* Detail pane (HANDOFF-INDEX-SURFACE D3): the object drawer. Selecting a row
   renders it here; selection never navigates. The composer at the bottom either
   corrects the engine (refile) or asks about the object. Empty selection shows a
   quiet prompt, not a placeholder illustration. */

const KIND_GLYPH: Record<IndexRowKind, React.ComponentType<{ className?: string }>> = {
  file: FileText,
  link: Link2,
  voice: Mic,
  task: SquareCheck,
  question: CircleHelp,
  tension: TriangleAlert,
  event: CalendarClock,
  note: NotebookPen,
};

/* Band- and kind-appropriate toolbar verbs. Refile is always first where a
   destination exists, since correcting the filing is the primary gesture. */
function actionsFor(row: IndexRow, hasDestination: boolean): readonly string[] {
  if (row.band === 'landed') {
    return hasDestination ? ['Refile', 'Open', 'Ask'] : ['Relink', 'Open', 'Ask'];
  }
  if (row.band === 'open') {
    if (row.kind === 'tension') return ['Look', 'Resolve'];
    if (row.kind === 'question') return ['Ask', 'Resolve', 'Park'];
    return ['Open', 'Draft', 'Done'];
  }
  return ['Open'];
}

function provenanceLine(row: IndexRow): string | null {
  if (!row.provenance) return null;
  const when = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    new Date(row.provenance.atMs),
  );
  const who = row.provenance.filedBy === 'agent' ? 'the agent' : 'capture';
  return `Filed by ${who}, ${when}`;
}

interface IndexDetailProps {
  row: IndexRow | null;
  destination: IndexRowDestination | null;
  receipt: string | null;
  onRefile: (label: string) => void;
  onUndo: () => void;
  onAction: (action: string) => void;
  onCompose: (text: string) => void;
}

export function IndexDetail({
  row,
  destination,
  receipt,
  onRefile,
  onUndo,
  onAction,
  onCompose,
}: IndexDetailProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [composeText, setComposeText] = useState('');
  const destInputRef = useRef<HTMLInputElement>(null);

  // Reset transient editors when the selected object changes.
  useEffect(() => {
    setEditing(false);
    setComposeText('');
  }, [row?.id]);

  useEffect(() => {
    if (editing) destInputRef.current?.focus();
  }, [editing]);

  if (!row) {
    return (
      <div className={styles.detail} aria-label="Object detail">
        <p className={styles.detailEmpty}>
          Select something to see how it was filed, correct it, or ask about it.
        </p>
      </div>
    );
  }

  const Glyph = KIND_GLYPH[row.kind] ?? FileText;
  const prov = provenanceLine(row);
  const actions = actionsFor(row, Boolean(destination));

  const beginEdit = () => {
    setDraft(destination?.label ?? '');
    setEditing(true);
  };
  const commitEdit = () => {
    const next = draft.trim();
    if (next && next !== destination?.label) onRefile(next);
    setEditing(false);
  };
  const handleAction = (action: string) => {
    if (action === 'Refile' || action === 'Relink') {
      beginEdit();
      return;
    }
    onAction(action);
  };
  const submitCompose = () => {
    const text = composeText.trim();
    if (!text) return;
    onCompose(text);
    setComposeText('');
  };

  return (
    <div className={styles.detail} aria-label="Object detail">
      <div className={styles.detailScroll}>
        <div className={styles.detailHead}>
          <span
            className={`${styles.detailKind} ${row.isTension ? styles.detailKindTension : ''}`}
          >
            <Glyph />
          </span>
          <div>
            <h2 className={styles.detailTitle}>{row.title}</h2>
            {prov && <div className={styles.detailProv}>{prov}</div>}
          </div>
        </div>

        {destination && (
          <div className={styles.filed}>
            <span className={styles.filedLabel}>{destination.verb}</span>
            {editing ? (
              <input
                ref={destInputRef}
                className={styles.destInput}
                value={draft}
                aria-label="Filed-to destination"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <button type="button" className={styles.destToken} onClick={beginEdit}>
                {destination.label}
              </button>
            )}
          </div>
        )}

        <div className={styles.toolbar} role="group" aria-label="Actions">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              className={styles.toolBtn}
              onClick={() => handleAction(action)}
            >
              {action}
            </button>
          ))}
        </div>

        {(receipt || row.provenance?.filedBy === 'agent') && (
          <div className={styles.receipts}>
            {receipt && (
              <div className={styles.receipt}>
                <span className={styles.receiptDot} />
                <span className={styles.receiptText}>{receipt}</span>
                <button type="button" className={styles.receiptUndo} onClick={onUndo}>
                  Undo
                </button>
              </div>
            )}
            {!receipt && row.provenance?.filedBy === 'agent' && (
              <div className={styles.receipt}>
                <span className={styles.receiptDot} />
                <span className={styles.receiptText}>The agent filed this for you.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.composerField}
          value={composeText}
          placeholder="Correct where this is filed, or ask about it."
          aria-label="Correct or ask about this object"
          rows={2}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitCompose();
            }
          }}
        />
        <div className={styles.composerHint}>Enter to send, Shift+Enter for a new line.</div>
      </div>
    </div>
  );
}
