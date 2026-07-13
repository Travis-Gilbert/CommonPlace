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
  ChevronRight,
} from 'lucide-react';
import {
  REFILE_CONFIDENCE_THRESHOLD,
  type IndexRow,
  type IndexRowDestination,
  type IndexRowKind,
} from '@/lib/commonplace/index-queries';

/* Detail pane (HANDOFF-INDEX-SURFACE D3), on the console register. Selecting a
   row renders it here; selection never navigates. The composer corrects the
   engine (refile) or asks about the object. Empty selection shows a quiet
   prompt, not a placeholder illustration. */

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

const TOOL_BTN =
  'cursor-pointer rounded-cr-sm border border-cr-hairline bg-cr-top px-cr-2 py-[5px] font-cr-mono ' +
  'text-cr-caption uppercase tracking-[0.05em] text-cr-ink-2 transition-colors duration-chrome ease-cr ' +
  'hover:border-cr-signal hover:text-cr-signal focus-visible:[outline:2px_solid_var(--cr-signal)] ' +
  'focus-visible:outline-offset-1';

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

/* Filing rationale (IX7): why this landed where it did, in plain language, with
   the raw signals behind one disclosure. Everything is derived from fields the
   row already carries (destination edge, classification confidence,
   provenance, tags), so nothing is invented. The IX3 filing record (per-decision
   margin + scored signals) is the backend upgrade this reads into unchanged. */

interface FilingSignal {
  readonly label: string;
  readonly value: string;
  readonly confidence?: number;
}

interface FilingRationale {
  readonly summary: string;
  readonly signals: readonly FilingSignal[];
}

function clarityPhrase(confidence: number): string {
  if (confidence >= 0.85) return 'a clear match';
  if (confidence >= REFILE_CONFIDENCE_THRESHOLD) return 'a likely match';
  return 'an uncertain match, worth a second look';
}

function filingRationale(row: IndexRow, destination: IndexRowDestination | null): FilingRationale {
  const who = row.provenance
    ? row.provenance.filedBy === 'agent'
      ? 'the agent'
      : 'capture'
    : null;
  const conf = row.classificationConfidence;

  const signals: FilingSignal[] = [];
  if (destination) {
    signals.push({ label: destination.verb, value: destination.label });
  }
  if (conf !== undefined) {
    signals.push({ label: 'confidence', value: `${Math.round(conf * 100)}%`, confidence: conf });
  }
  if (row.provenance) {
    const when = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
      new Date(row.provenance.atMs),
    );
    signals.push({ label: 'filed', value: `${who}, ${when}` });
  }
  if (row.tags.length > 0) {
    signals.push({ label: 'tags', value: row.tags.join(', ') });
  }

  if (!destination) {
    const summary =
      row.kind === 'question'
        ? 'Not filed. It is an open question, so it waits on you instead of a folder.'
        : row.kind === 'tension'
          ? 'Not filed. Two sources disagree; resolving it decides where the answer lands.'
          : 'Not filed yet. Give it a destination and it will train the filer.';
    return { summary, signals };
  }

  const clarity = conf !== undefined ? ` on ${clarityPhrase(conf)}` : '';
  const byWhom = who ? ` by ${who}` : '';
  const summary = `${destination.verb === 'linked to' ? 'Linked to' : 'Filed to'} ${destination.label}${byWhom}${clarity}.`;
  return { summary, signals };
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

  // The parent remounts this pane per selection (key), so the editors reset on
  // their own; no reset effect needed.
  useEffect(() => {
    if (editing) destInputRef.current?.focus();
  }, [editing]);

  if (!row) {
    return (
      <div
        className="flex h-full items-center justify-center bg-cr-surface"
        aria-label="Object detail"
      >
        <p className="max-w-[34ch] px-cr-4 text-center text-cr-small leading-relaxed text-cr-ink-3">
          Select something to see how it was filed, correct it, or ask about it.
        </p>
      </div>
    );
  }

  const Glyph = KIND_GLYPH[row.kind] ?? FileText;
  const prov = provenanceLine(row);
  const actions = actionsFor(row, Boolean(destination));
  const rationale = filingRationale(row, destination);

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
    <div className="flex h-full min-h-0 flex-col bg-cr-surface" aria-label="Object detail">
      <div className="min-h-0 flex-1 overflow-y-auto p-cr-3">
        <div className="flex items-start gap-cr-2">
          <span
            className={`flex size-[34px] shrink-0 items-center justify-center rounded-cr [&>svg]:size-[18px] ${
              row.isTension ? 'bg-cr-tint text-cr-signal' : 'bg-cr-ground text-cr-ink-2'
            }`}
          >
            <Glyph />
          </span>
          <div className="min-w-0">
            <h2 className="font-cr-ui text-cr-h3 font-bold leading-tight text-cr-ink">{row.title}</h2>
            {prov && (
              <div className="mt-[6px] font-cr-mono text-cr-caption uppercase tracking-[0.05em] text-cr-ink-3">
                {prov}
              </div>
            )}
          </div>
        </div>

        {destination && (
          <div className="mt-cr-3 flex flex-wrap items-center gap-cr-2 text-cr-small text-cr-ink-2">
            <span className="text-cr-ink-3">{destination.verb}</span>
            {editing ? (
              <input
                ref={destInputRef}
                className="min-w-[14ch] rounded-cr-sm border border-cr-signal bg-cr-top px-cr-2 py-[3px] text-cr-ink focus-visible:outline-none"
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
              <button
                type="button"
                onClick={beginEdit}
                className="cursor-pointer rounded-cr-sm border border-cr-hairline bg-cr-ground px-cr-2 py-[3px] text-cr-ink-2 transition-colors duration-chrome ease-cr hover:border-cr-signal hover:text-cr-signal focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
              >
                {destination.label}
              </button>
            )}
          </div>
        )}

        <section
          aria-label="Why here"
          className="mt-cr-3 rounded-cr border border-cr-hairline bg-cr-ground p-cr-2"
        >
          <div className="mb-cr-1 font-cr-mono text-cr-caption uppercase tracking-[0.08em] text-cr-ink-3">
            Why here
          </div>
          <p className="m-0 text-cr-small leading-snug text-cr-ink-2">{rationale.summary}</p>
          {rationale.signals.length > 0 && (
            <details className="group mt-cr-2">
              <summary className="inline-flex cursor-pointer list-none items-center gap-cr-1 font-cr-mono text-cr-caption uppercase tracking-[0.05em] text-cr-ink-3 transition-colors duration-chrome ease-cr hover:text-cr-ink-2 focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-[0.9em] transition-transform duration-chrome ease-cr group-open:rotate-90"
                  aria-hidden="true"
                />
                Signals
              </summary>
              <dl className="mt-cr-1 flex flex-col gap-cr-1">
                {rationale.signals.map((signal) => (
                  <div key={signal.label} className="flex items-baseline gap-cr-2">
                    <dt className="w-[9ch] shrink-0 font-cr-mono text-cr-caption uppercase tracking-[0.04em] text-cr-ink-3">
                      {signal.label}
                    </dt>
                    <dd className="m-0 min-w-0 flex-1 text-cr-caption text-cr-ink-2">
                      {signal.confidence !== undefined ? (
                        <span className="flex items-center gap-cr-2">
                          <span className="relative h-[3px] w-[56px] overflow-hidden rounded-full bg-cr-hairline">
                            <span
                              className={`absolute inset-y-0 left-0 rounded-full ${
                                signal.confidence < REFILE_CONFIDENCE_THRESHOLD
                                  ? 'bg-cr-signal'
                                  : 'bg-cr-link'
                              }`}
                              style={{ width: `${Math.round(signal.confidence * 100)}%` }}
                            />
                          </span>
                          <span className="tabular-nums">{signal.value}</span>
                        </span>
                      ) : (
                        signal.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </section>

        <div className="mt-cr-3 flex flex-wrap gap-cr-1" role="group" aria-label="Actions">
          {actions.map((action) => (
            <button key={action} type="button" className={TOOL_BTN} onClick={() => handleAction(action)}>
              {action}
            </button>
          ))}
        </div>

        {(receipt || row.provenance?.filedBy === 'agent') && (
          <div className="mt-cr-3 flex flex-col gap-cr-1">
            {receipt && (
              <div className="flex items-center gap-cr-2 rounded-cr bg-cr-ground px-cr-2 py-cr-1 text-cr-small text-cr-ink-2">
                <span className="size-[6px] shrink-0 rounded-full bg-cr-link" />
                <span className="min-w-0 flex-1">{receipt}</span>
                <button
                  type="button"
                  onClick={onUndo}
                  className="cursor-pointer rounded-cr-sm border border-cr-hairline px-cr-2 py-[2px] font-cr-mono text-cr-caption uppercase tracking-[0.05em] text-cr-ink-2 transition-colors duration-chrome ease-cr hover:border-cr-signal hover:text-cr-signal focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-1"
                >
                  Undo
                </button>
              </div>
            )}
            {!receipt && row.provenance?.filedBy === 'agent' && (
              <div className="flex items-center gap-cr-2 rounded-cr bg-cr-ground px-cr-2 py-cr-1 text-cr-small text-cr-ink-2">
                <span className="size-[6px] shrink-0 rounded-full bg-cr-link" />
                <span className="min-w-0 flex-1">The agent filed this for you.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-cr-hairline p-cr-3">
        <textarea
          className="w-full resize-none rounded-cr border border-cr-hairline bg-cr-top px-cr-2 py-cr-1 font-cr-ui text-cr-small text-cr-ink placeholder:text-cr-ink-3 focus-visible:[outline:2px_solid_var(--cr-signal)] focus-visible:outline-offset-0"
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
        <div className="mt-cr-1 text-cr-caption text-cr-ink-3">
          Enter to send, Shift+Enter for a new line.
        </div>
      </div>
    </div>
  );
}
