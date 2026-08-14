// SOURCING: OWOX/models HistoryPanel (Apache-2.0). Bound to registry versions, not model_versions.

import { Clock, GitCompare, RotateCcw } from 'lucide-react';

export type RegistryVersionRow = {
  id: string;
  label: string;
  createdAt?: string;
};

export function HistoryPanel({
  versions,
  onCompare,
  onRestore,
}: {
  versions: readonly RegistryVersionRow[];
  onCompare(id: string): void;
  onRestore(id: string): void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg border border-[color:var(--ij-border,#d8dee8)] px-3 py-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ij-info-bg,#e6f1fb)] text-[color:var(--ij-link,#1e88e5)]">
          <Clock size={16} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-[color:var(--ij-ink,#0f172a)]">
            Version history
          </div>
          <div className="text-[12px] text-[color:var(--ij-text-secondary,#64748b)]">
            Compare registry versions; restore declares a new batch
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[color:var(--ij-border,#d8dee8)] px-3 py-2.5">
        <span className="text-[13px] font-[550] text-[color:var(--ij-ink,#0f172a)]">Current</span>
        {versions.length > 0 ? (
          <button
            type="button"
            onClick={() => onCompare(versions[0].id)}
            className="flex cursor-pointer items-center gap-1 text-[12px] text-[color:var(--ij-text-secondary,#64748b)] hover:text-[color:var(--ij-link,#1e88e5)]"
          >
            <GitCompare size={13} /> Compare
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        {versions.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[color:var(--ij-text-secondary,#94a3b8)]">
            No registry versions yet.
          </p>
        ) : null}
        {versions.map((v, i) => (
          <div
            key={v.id}
            className="group rounded-lg px-2 py-1.5 hover:bg-[color:var(--ij-hover-surface,#f7f8fa)]"
          >
            <div className="text-[13px] font-[550] text-[color:var(--ij-ink,#0f172a)]">
              {i === 0 ? 'Latest' : v.label}
            </div>
            {v.createdAt ? (
              <div className="text-[11px] text-[color:var(--ij-text-secondary,#94a3b8)]">
                {new Date(v.createdAt).toLocaleString()}
              </div>
            ) : null}
            <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onCompare(v.id)}
                className="flex cursor-pointer items-center gap-1 text-[11.5px] text-[color:var(--ij-text-secondary,#64748b)] hover:text-[color:var(--ij-link,#1e88e5)]"
              >
                <GitCompare size={13} /> Compare
              </button>
              <button
                type="button"
                onClick={() => onRestore(v.id)}
                className="flex cursor-pointer items-center gap-1 text-[11.5px] text-[color:var(--ij-text-secondary,#64748b)] hover:text-[color:var(--ij-link,#1e88e5)]"
              >
                <RotateCcw size={13} /> Restore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
