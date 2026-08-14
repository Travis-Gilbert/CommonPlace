// SOURCING: OWOX/models MyModelsPanel (Apache-2.0). Supabase SavedModel list replaced
// with optional host-provided registry scopes.

import { Boxes } from 'lucide-react';

export type ModelScopeRow = {
  id: string;
  title: string;
  subtitle?: string;
};

export function MyModelsPanel({
  models,
  activeId,
  onOpen,
}: {
  models: readonly ModelScopeRow[];
  activeId?: string | null;
  onOpen?(id: string): void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-[color:var(--ij-border,#d8dee8)] px-3 py-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ij-info-bg,#e6f1fb)] text-[color:var(--ij-link,#1e88e5)]">
          <Boxes size={16} />
        </div>
        <div>
          <div className="text-[13px] font-medium text-[color:var(--ij-ink,#0f172a)]">
            Model scopes
          </div>
          <div className="text-[12px] text-[color:var(--ij-text-secondary,#64748b)]">
            Registry topics rendered as canvases
          </div>
        </div>
      </div>
      {models.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[color:var(--ij-text-secondary,#94a3b8)]">
          The active workspace topic is the current model.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {models.map((model) => {
            const active = model.id === activeId;
            return (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => onOpen?.(model.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-[13px] ${
                    active
                      ? 'bg-[color:var(--ij-selection,#e8f1fb)] text-[color:var(--ij-ink,#0f172a)]'
                      : 'hover:bg-[color:var(--ij-hover-surface,#f7f8fa)]'
                  }`}
                >
                  <div className="font-[550]">{model.title}</div>
                  {model.subtitle ? (
                    <div className="text-[11px] text-[color:var(--ij-text-secondary,#94a3b8)]">
                      {model.subtitle}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
