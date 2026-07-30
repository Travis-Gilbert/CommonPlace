import type { ReactNode } from "react";
import type { ModelGraph } from "@commonplace/okf";
import { diffGraphs } from "../lib/diff";

// Shows the structural diff between a past version and the current canvas -- which
// tables, fields and joins were added or removed.
export function DiffDialog({ prev, next, label, onClose }: { prev: ModelGraph; next: ModelGraph; label: string; onClose: () => void }) {
  const d = diffGraphs(prev, next);

  const Row = ({ sign, color, text }: { sign: string; color: string; text: string }) => (
    <div className="flex gap-2 text-sm"><span className={`font-semibold ${color}`}>{sign}</span><span className="text-ij-ink">{text}</span></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ij-hover-overlay" onClick={onClose}>
      <div className="max-h-screen w-full max-w-xl overflow-y-auto rounded-ij-arc border border-ij-seam-raised bg-ij-raised p-7 text-ij-ink" onClick={e => e.stopPropagation()}>
        <h1 className="text-lg font-semibold">Changes since {label}</h1>
        <p className="mt-1 text-sm text-ij-ink-info">Comparing that version to your current canvas.</p>

        {!d.changed ? (
          <p className="mt-6 rounded-ij-arc border border-ij-seam bg-ij-editor p-5 text-center text-sm text-ij-ink-info">No structural changes -- same tables, fields and joins.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {(d.tables.added.length > 0 || d.tables.removed.length > 0) && (
              <Section title="Tables">
                {d.tables.added.map(t => <Row key={"ta" + t} sign="+" color="text-ij-ok" text={t} />)}
                {d.tables.removed.map(t => <Row key={"tr" + t} sign="−" color="text-ij-error" text={t} />)}
              </Section>
            )}
            {d.fields.length > 0 && (
              <Section title="Fields">
                {d.fields.map(f => (
                  <div key={f.table} className="text-sm">
                    <div className="font-medium text-ij-ink">{f.table}</div>
                    {f.added.map(n => <Row key={"fa" + n} sign="+" color="text-ij-ok" text={n} />)}
                    {f.removed.map(n => <Row key={"fr" + n} sign="−" color="text-ij-error" text={n} />)}
                    {f.modified.map(n => <Row key={"fm" + n} sign="~" color="text-ij-warn" text={n} />)}
                  </div>
                ))}
              </Section>
            )}
            {(d.joins.added.length > 0 || d.joins.removed.length > 0) && (
              <Section title="Joins">
                {d.joins.added.map(j => <Row key={"ja" + j} sign="+" color="text-ij-ok" text={j} />)}
                {d.joins.removed.map(j => <Row key={"jr" + j} sign="−" color="text-ij-error" text={j} />)}
              </Section>
            )}
          </div>
        )}

        <button onClick={onClose} className="mt-6 w-full cursor-pointer text-sm text-ij-ink-info hover:text-ij-ink">Close</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-ij-arc border border-ij-seam bg-ij-editor p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ij-ink-info">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
